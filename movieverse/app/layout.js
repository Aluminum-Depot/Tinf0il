import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/partials/header/Header";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UserInfoProvider } from "@/context/UserInfoContext";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

// Tab cloak (on by default) — mirrors public/assets/js/settings.js so the /tv
// app's tab is disguised too (its page titles otherwise leak "tinf0il TV").
// Reads the same localStorage keys the main site's cloak settings write.
const TAB_CLOAK = `(function(){try{
  var DT="Classroom",DI="https://ssl.gstatic.com/classroom/favicon.png";
  var t=function(){return localStorage.getItem("websiteTitle")||DT;};
  var ic=function(){return localStorage.getItem("websiteIcon")||DI;};
  var apply=function(){
    if(document.title!==t())document.title=t();
    var f=document.querySelector("link[rel='icon']");
    if(!f){f=document.createElement("link");f.rel="icon";document.head.appendChild(f);}
    if(f.href!==ic())f.href=ic();
  };
  apply();
  var el=document.querySelector("title");
  if(el){new MutationObserver(function(){if(document.title!==t())document.title=t();})
    .observe(el,{childList:true,subtree:true,characterData:true});}
  document.addEventListener("visibilitychange",apply);
}catch(e){}})();`;

export default async function RootLayout({ children }) {

  return (
    <html lang="en">
      <body className={inter.className}>
        <Script id="tab-cloak" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: TAB_CLOAK }} />
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
