import { Outlet } from "react-router-dom";
import NgoSidebar from "@/components/NgoSidebar";

const NgoLayout = () => {
  return (
    <div className="flex min-h-screen w-full">
      <NgoSidebar />
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default NgoLayout;
