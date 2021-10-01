import * as React from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";

const AboutPage: React.FunctionComponent = () => {
   const [state, setState] = useState<number>(0);

   const handleButtonClick = () => {
      setState((prev) => prev += 1);
   };

   return (
      <div>
         <h3>Counter</h3>
         <p>{state}</p>

         <button onClick={handleButtonClick}>++</button>
      </div>
   );
};

export function head() {
   return {
      title: "ABOUT",
      description: "Ye que pasa prims",
   };
}

export default AboutPage;
