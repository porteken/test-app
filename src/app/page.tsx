import dynamic from "next/dynamic";
const Test = dynamic(() => import("../components/table-pagination"));

export default function Home() {
  return (
    <>
      <Test />
    </>
  );
}
