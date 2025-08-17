import dynamic from "next/dynamic";
const Test = dynamic(() => import("../../components/editable"));

export default function Home() {
  return (
    <>
      <Test />
    </>
  );
}
