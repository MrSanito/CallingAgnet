import { Outfit } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "SalesCRM AI Dashboard",
  description: "AI Voice and Alerts Dashboard for SalesCRM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="h-full bg-slate-50 flex font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
