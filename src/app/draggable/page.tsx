import dynamic from "next/dynamic";
const Drag = dynamic(() => import("../../components/drag"));

export default function Home() {
  return (
    <>
      <Drag />
    </>
  );
}
