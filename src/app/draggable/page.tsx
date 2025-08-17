import dynamic from "next/dynamic";
const Test = dynamic(() => import("../../components/draggable"));

export default function Home() {
  return (
    <>
      <Test />
    </>
  );
}
