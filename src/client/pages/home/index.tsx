import * as React from "https://esm.sh/preact";

const HomePage: React.FunctionComponent<{ url: string }> = ({ url }) => {
   const st = [1, 2, 3, 4, 5, 6, 7];

   return (
      <div
         class={`box box-oye`}
      >
         <b>{url ? url + " PLUS HYDRATION" : "ONLY CLIENTE"}</b>

         <ul>
            {st.map((k) => <li key={k}>{k}</li>)}
         </ul>

         <button
            onClick={() => {
               console.log("HOla!!");
            }}
         >
            Go!
         </button>
      </div>
   );
};

export function middleware(request: Request): { props: unknown } {
   return {
      props: {
         url: request.url,
      },
   };
}

export function head() {
   return {
      title: "HOME",
      description: "Ye que pasa prims",
   };
}

export default HomePage;
