import * as React from "https://esm.sh/preact";

const IndexPage: React.FunctionComponent = () => {
   return (
      <div
         class={`box box-oye`}
      >
         <h2>Index</h2>

         <button
            onClick={() => {
               console.log("Hello from Index!");
            }}
         >
            See console
         </button>
      </div>
   );
};

export function head() {
   return {
      title: "INDEX",
      description: "Ye que pasa prims",
   };
}

export default IndexPage;
