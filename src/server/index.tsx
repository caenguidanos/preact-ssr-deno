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
            return handleClientBrowserRoute(request, pathname);
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

function handleClientBrowserRoute(
   _request: Request,
   pathname: string,
): Response {
   try {
      const headers = new Headers();
      headers.append("content-type", "text/html; charset=8");

      const pagePathname = "_deno/build/pages" + pathname;

      const textEncoder = new TextEncoder();

      const htmlFile = Deno.readTextFileSync(pagePathname + "/index.html");
      const context: string = JSON.stringify({ "url": "sin middleware" });
      const contextUintArray: Uint8Array = textEncoder.encode(context);

      const withData = htmlFile.concat(
         `<script id="__DENO__" deno-data="${contextUintArray.toString()}" deno-route="${pathname}"></script></body>`,
      );

      return new Response(
         withData,
         { headers },
      );
   } catch {
      return new Response("UPS", { status: 404 });
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

   for (const page of pages) {
      const STATIC_NODE = '<div id="__deno"></div>';
      const V_STATIC_NODE = (html: string) => `<div id="__deno">${html}</div>`;

      // Create folder
      const distPath = page.replace("src/client/", "").replace(".tsx", ".html");
      const distFilePath = "_deno/build/" + distPath;
      const distFolderPath = distFilePath.replace("/index.html", "");

      await Deno.mkdir(distFolderPath, { recursive: true });
      // Import export default function component
      const { default: PageComponent } = await import(Deno.cwd() + "/" + page);

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
   }
}
