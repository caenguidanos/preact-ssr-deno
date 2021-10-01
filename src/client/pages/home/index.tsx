import * as React from "https://esm.sh/preact";

const HomePage: React.FunctionComponent = () => {
   const st = [1, 2, 3, 4, 5];

   return (
      <div
         onClick={() => {
            console.log("alojomora");
         }}
         class={`box box-oye`}
      >
         <b>Adios</b>

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

export default HomePage;
