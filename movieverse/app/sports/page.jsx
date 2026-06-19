import SportsList from "@/content/sports/SportsList"

export const metadata = {
  title: "Live Sports — 1MMUN3 TV",
  description: "Watch live sports streams. Auto-updating.",
}

const SportsPage = () => {
  return (
    <>
      <div className="w-full flex flex-col items-center z-10 relative main-responsive top-[106px]">
        <div className="w-full max-w-[96rem]">

          <div className="mb-8">
            <h1 className="text-[#ffffffbd] font-medium text-3xl font-['poppins'] mb-2">| Live Sports</h1>
            <p className="text-[#5c5c6e] text-sm">Streams update automatically · refreshes every 60 seconds</p>
          </div>

          <SportsList />

        </div>
      </div>

      <div className="fixed w-[138.33px] h-[82.25px] left-[1%] top-[2%] bg-[#92b7fc8f] blur-[200px]" />
      <div className="fixed w-[500px] h-[370.13px] right-[50%] bottom-[20%] bg-[#576683b4] blur-[215.03px] translate-x-[70%] z-0 rounded-full" />
    </>
  )
}

export default SportsPage
