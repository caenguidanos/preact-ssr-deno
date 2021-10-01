import { serve } from "https://deno.land/std@0.107.0/http/server.ts";
import { exists } from "https://deno.land/std@0.109.0/fs/mod.ts";
import * as React from "https://esm.sh/preact";
import * as esbuild from "https://deno.land/x/esbuild@v0.13.3/mod.js";
import renderToString from "https://esm.sh/preact-render-to-string";
import glob from "https://esm.sh/tiny-glob";
import { nanoid } from "https://esm.sh/nanoid";

bootstrap();

async function bootstrap(): Promise<void> {
   await bundle();

   const listener = Deno.listen({ port: 8080 });

   await serve(listener, async (request) => {
      const host: string | null = request.headers.get("host");

      if (!host) {
         return new Response("INVALID HOST", { status: 400 });
      }

      const pathname: string | undefined = request.url.split(host).pop();

      if (!pathname) {
         return new Response("INVALID URL", { status: 400 });
      }

      const isStaticAssetRoute = pathname.match(/public(.*)/gi);
      const isApiFunctionRoute = pathname.match(/api(.*)/gi);
      const isStaticDistRoute = pathname.match(/_deno(.*)/gi);
      const isClientBrowserRoute = pathname.match(/(.*)/gi);

      try {
         if (isStaticAssetRoute) {
            return await handleStaticAssetRoute(request, pathname);
         }

         if (isApiFunctionRoute) {
            return handleApiFunctionRoute(request, pathname);
         }

         if (isStaticDistRoute) {
            return await handleStaticDistRoute(request, pathname);
         }

         if (isClientBrowserRoute) {
            return await handleClientBrowserRoute(request, pathname);
         }

         return handleOtherRoute();
      } catch (error) {
         return handleErrorRoute(error);
      }
   });
}

async function handleStaticAssetRoute(
   _request: Request,
   pathname: string,
): Promise<Response> {
   const headers = new Headers();

   headers.append("content-type", "text/html; charset=8");

   const localPath = Deno.cwd() + pathname;
   const buffer = await Deno.readFile(localPath);

   return new Response(buffer, { headers });
}

function handleErrorRoute(error: unknown): Response {
   const headers = new Headers();
   headers.append("content-type", "text/html; charset=8");

   return new Response(error as string, { status: 500, headers });
}

async function handleStaticDistRoute(
   _request: Request,
   pathname: string,
): Promise<Response> {
   try {
      const headers = new Headers();
      headers.append("content-type", "application/javascript; charset=8");

      const localPath = Deno.cwd() + pathname;
      const buffer = await Deno.readFile(localPath);

      return new Response(buffer, { headers });
   } catch (error) {
      return new Response(error, { status: 500 });
   }
}

function handleApiFunctionRoute(
   _request: Request,
   _pathname: string,
): Response {
   const headers = new Headers();

   headers.append("content-type", "text/plain; charset=8");

   return new Response("API", { headers });
}

async function handleClientBrowserRoute(
   request: Request,
   pathname: string,
): Promise<Response> {
   try {
      const headers = new Headers();
      headers.append("content-type", "text/html; charset=8");

      const pagePathname = "_deno/build/pages" + pathname;

      const manifest = await Deno.readTextFile("_deno/build/ssr_manifest.json");
      const decodedManifest = JSON.parse(manifest) as any[];

      let context: unknown = {};

      for (const k of decodedManifest) {
         if (k.middleware) {
            const { middleware } = await import(Deno.cwd() + "/src/client/pages" + pathname + "/index.tsx");
            if (middleware.constructor.name === "AsyncFunction") {
               const { props } = await middleware(request);
               context = props;
            } else {
               const { props } = middleware(request);
               context = props;
            }
         }
      }

      const textEncoder = new TextEncoder();

      const htmlFile = Deno.readTextFileSync(pagePathname + "/index.html");
      const contextUintArray: Uint8Array = textEncoder.encode(JSON.stringify(context));

      const withData = htmlFile.concat(
         `<script id="__DENO__" deno-data="${contextUintArray.toString()}" deno-route="${pathname}"></script></body>`,
      );

      return new Response(
         withData,
         { headers },
      );
   } catch (error) {
      return new Response(error, { status: 404 });
   }
}

function handleOtherRoute() {
   const headers = new Headers();
   headers.append("content-type", "text/plain; charset=8");

   return new Response("NOT FOUND", { status: 404, headers });
}

async function bundle() {
   console.log("START BUNDLE");

   const pages: string[] = await glob(Deno.cwd() + "/src/client/pages/**/*.{tsx}");
   const htmlTemplate: string = await Deno.readTextFile("public/index.html");

   // Create fs folders
   const distFolderExists = await exists("_deno");
   if (distFolderExists) {
      await Deno.remove("_deno", { recursive: true });
   }

   const manifest = [];

   for (const page of pages) {
      const STATIC_NODE = '<div id="__deno"></div>';
      const V_STATIC_NODE = (html: string) => `<div id="__deno">${html}</div>`;

      // Create folder
      const distPath = page.replace("src/client/", "").replace(".tsx", ".html");
      const distFilePath = "_deno/build/" + distPath;
      const distFolderPath = distFilePath.replace("/index.html", "");

      await Deno.mkdir(distFolderPath, { recursive: true });
      // Import export default function component
      const { default: PageComponent, middleware, head } = await import(Deno.cwd() + "/" + page);

      // Add hydration to component
      let hydrationTemplate = await Deno.readTextFile("src/server/injections/__hydration__");
      hydrationTemplate = hydrationTemplate.replace(/%COMPONENT%/, PageComponent.name);
      const contentPageComponent = await Deno.readTextFile(page);
      const PAGE_TEMP = page.replace(".tsx", "__temp__.tsx");
      await Deno.writeTextFile(PAGE_TEMP, contentPageComponent + "\n" + hydrationTemplate);

      const result = await Deno.emit(PAGE_TEMP, {
         check: false,
         bundle: "module",
         compilerOptions: {
            lib: ["dom", "dom.iterable", "dom.asynciterable", "deno.ns", "deno.unstable"],
         },
      });
      const compiledFileId = nanoid(45);
      const compiledFileName = distFolderPath + "/" + compiledFileId + ".js";
      await Deno.writeTextFile(compiledFileName, result.files["deno:///bundle.js"]);

      // Render to static string
      const html = renderToString(<PageComponent />);

      // Create render view from template
      const render = htmlTemplate.replace(STATIC_NODE, V_STATIC_NODE(html)).replace(
         "</body>",
         `<script src="${compiledFileName.replace(".js", ".min.js")}" type="module" defer></script></body>`,
      ).replace(
         "</head>",
         `<title>${head().title}</title><meta name="description" content="${head().description}"></meta>`,
      );

      // Write HTML to file system
      await Deno.writeTextFile(distFilePath, render);
      await Deno.remove(PAGE_TEMP);

      // minify
      await esbuild.build({
         entryPoints: [compiledFileName],
         minify: true,
         outfile: compiledFileName.replace(".js", ".min.js"),
      });

      manifest.push({
         id: compiledFileId,
         compiled: compiledFileName,
         path: distFolderPath,
         url: distFolderPath === "_deno/build/pages" ? "/" : distFolderPath.replace("_deno/build/pages", ""),
         middleware: !!middleware,
         head: head(),
      });
   }

   await Deno.writeTextFile("_deno/build/ssr_manifest.json", JSON.stringify(manifest, undefined, 3));
}
