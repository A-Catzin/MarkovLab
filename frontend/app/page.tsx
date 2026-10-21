import { Hero } from "@/components/landing/Hero";
import { Intro } from "@/components/landing/Intro";
import { Modules } from "@/components/landing/Modules";
import { Pipeline } from "@/components/landing/Pipeline";
import { Questions } from "@/components/landing/Questions";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";
import { Simulator } from "@/components/landing/Simulator";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { runDemo } from "@/lib/demo";
import { DEFAULT_REQUEST } from "@/lib/landing-data";

export default function LandingPage() {
  const initial = runDemo(DEFAULT_REQUEST);
  return (
    <>
      <div className="page">
        <Hero />
        <main>
          <Intro />
          <Simulator initial={initial} />
          <Modules />
          <Pipeline />
          <Questions />
        </main>
      </div>
      <SiteFooter />
      <RevealOnScroll />
    </>
  );
}
