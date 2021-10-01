import * as React from "https://esm.sh/preact";

const IndexPage: React.FunctionComponent = () => {
   const st = [1, 2, 3, 4, 5];

   return (
      <div
         onClick={() => {
            console.log("alojomora");
         }}
         class={`box box-oye`}
      >
         <h2>Index</h2>

         <button
            onClick={() => {
               console.log("HOla!! desde index");
            }}
         >
            CLick
         </button>
      </div>
   );
};

export default IndexPage;
