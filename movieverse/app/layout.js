import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/partials/header/Header";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UserInfoProvider } from "@/context/UserInfoContext";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });


export default async function RootLayout({ children }) {

  return (
    <html lang="en">
      <body className={inter.className}>
        <UserInfoProvider>
          <Header />
          {children}
          <Analytics />
        </UserInfoProvider>

        <ToastContainer draggable theme="dark" />

      </body>
    </html>
  );
}
