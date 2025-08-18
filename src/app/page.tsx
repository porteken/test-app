import dynamic from "next/dynamic";
const Main = dynamic(() => import("../components/main"));

export default function Home() {
  return (
    <>
      <Main />
    </>
  );
}
