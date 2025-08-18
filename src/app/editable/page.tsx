import dynamic from "next/dynamic";
const Edit = dynamic(() => import("../../components/edit"));

export default function Home() {
  return (
    <>
      <Edit />
    </>
  );
}
