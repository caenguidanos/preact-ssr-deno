import * as React from "https://esm.sh/preact";

const HomePage: React.FunctionComponent<{ url: string }> = ({ url }) => {
   const st = [1, 2, 3, 4, 5, 6, 7];

   return (
      <div
         onClick={() => {
            console.log("alojomora");
         }}
         class={`box box-oye`}
      >
         <b>Adios</b>
         <b>{url ? url + "PLUS HYDRATION" : "ONLY CLIENTE"}</b>

         <ul>
            {st.map((k) => <li key={k}>{k}</li>)}
         </ul>

         <button
            onClick={() => {
               console.log("HOla!!");
            }}
         >
            CLick
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

export default HomePage;
