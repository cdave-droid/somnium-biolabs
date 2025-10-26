'use client';

import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import FooterNav from '../components/FooterNav';
import Navigation from '../components/Navigation';
import { LiquidButton } from '../components/ui/liquid-glass-button';

export default function Technology() {
  const [activeSection, setActiveSection] = useState('unified-patient-twin');
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const blueSectionHeight = 600;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      
      // Show bottom bar when scrolling past the blue section
      setShowBottomBar(scrollPosition > blueSectionHeight);
      
      // Hide bottom bar when approaching footer (around 80% scroll or when near footer)
      const footerThreshold = documentHeight - windowHeight - 200; // 200px before footer
      setHideBottomBar(scrollPosition >= footerThreshold);
      
      // Calculate scroll progress for the gradient line (only in white content area, before footer)
      if (scrollPosition > blueSectionHeight && scrollPosition < footerThreshold) {
        const contentScrollPosition = scrollPosition - blueSectionHeight;
        const contentHeight = footerThreshold - blueSectionHeight;
        const contentScrollPercentage = (contentScrollPosition / contentHeight) * 100;
        setScrollProgress(Math.min(contentScrollPercentage, 100));
      } else {
        setScrollProgress(0);
      }
      
      // Reset to first section when scrolling back up to the top
      if (scrollPosition <= blueSectionHeight) {
        setActiveSection('unified-patient-twin');
        return;
      }
      
      // Only track sections when we're in the white content area
      if (scrollPosition > blueSectionHeight - 100) {
        for (const [sectionId, element] of Object.entries(sectionsRef.current)) {
          if (element) {
            const { offsetTop, offsetHeight } = element;
            const adjustedOffsetTop = offsetTop - blueSectionHeight;
            const adjustedScrollPosition = scrollPosition - blueSectionHeight;
            
            if (adjustedScrollPosition >= adjustedOffsetTop && adjustedScrollPosition < adjustedOffsetTop + offsetHeight) {
              setActiveSection(sectionId);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            setVisibleSections((prev) => new Set(prev).add(sectionId));
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    Object.values(sectionsRef.current).forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = sectionsRef.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sections = [
    { id: 'unified-patient-twin', title: 'Unified Patient Twin' },
    { id: 'collaborative-intelligence', title: 'Collaborative Intelligence' },
    { id: 'simulation-reasoning', title: 'Simulation and Clinical Reasoning' },
    { id: 'scaling-trust', title: 'Scaling Trust' },
    { id: 'road-ahead', title: 'The Road Ahead' }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <Navigation />
      
      {/* Header Section - Image background with blur */}
      <section className="py-20 text-white relative overflow-hidden">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/b1.jpg)' }}
        ></div>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/30"></div>
        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-sm bg-white/10"></div>
        {/* Noise/Texture overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-6 mt-20">
            Inside the Somnium Twin Engine™
          </h1>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
            <LiquidButton variant="technology" size="sm">
            Machine Learning
            </LiquidButton>
            <LiquidButton variant="technology" size="sm">
            Human Physiology
            </LiquidButton>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
          Instead of numerous of isolated snapshots, clinicians see a single, evolving portrait: a whole-patient context that supports real-time decision-making.
            </p>
        </div>
      </section>

      {/* Scrollable Main Content */}
      <section className="relative bg-stone-50">
        <div className="pb-20">
          <div className="flex relative">
            {/* Left Sidebar Navigation - Sticky to white content area - Hidden on mobile */}
            <div className="hidden md:block sticky top-24 left-0 h-fit z-40 pl-4 sm:pl-8 mr-4 sm:mr-8 pt-8">
              <nav className="space-y-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`block text-left transition-all duration-300 relative ${
                      activeSection === section.id
                        ? 'text-gray-900 font-medium text-base'
                        : 'text-gray-600 hover:text-gray-900 text-sm'
                    }`}
                  >
                    {/* Horizontal line before each item */}
                    <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 -ml-8 w-4 h-px transition-colors duration-300 ${
                      activeSection === section.id ? 'bg-gray-900' : 'bg-gray-400'
                    }`}></div>
                    
                    {activeSection === section.id && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -ml-8 w-px h-4 bg-gray-900"></div>
                    )}
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>

      {/* Main Content */}
            <div className="flex-1 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
            <div className="prose prose-lg max-w-none">
                
                {/* Introduction */}
                <div className="mb-16">
                  <p className="text-gray-700 leading-relaxed text-lg mb-8">
                    Our proprietary Somnium Twin Engine™ represents a paradigm shift on how medicine is practiced. Through the convergence of disruptive technologies, the Twin Engine provides a platform for comprehensive and personalized digital twins, unlocking magnitudes of new research and therapies for patients. The timeline and exorbitant cost required to go from hypothesis generation to bedside clinical benefit is reduced to a fraction, enabling a new generation of healthier patients and more cost-efficient healthcare systems.
                  </p>
                </div>

                {/* Unified Patient Twin */}
                <div 
                  ref={(el) => { sectionsRef.current['unified-patient-twin'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('unified-patient-twin') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="unified-patient-twin"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Unified Patient Twin
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    STE harmonizes clinical data from monitors, imaging, labs, and records into a real-time digital representation of each patient. It translates these signals into an evolving physiological model that reflects the patient's current and projected states.
                  </p>
                </div>

                {/* Collaborative Intelligence */}
                <div 
                  ref={(el) => { sectionsRef.current['collaborative-intelligence'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('collaborative-intelligence') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="collaborative-intelligence"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Collaborative Intelligence
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    Dozens of specialized AI systems — for diagnostics, organ function, treatment planning, and prediction — collaborate through STE's innovative platform. Instead of dozens of isolated snapshots, clinicians see a single, evolving portrait: a whole-patient context that supports real-time decision-making.
                  </p>
                </div>
                
                {/* Simulation and Clinical Reasoning */}
                <div 
                  ref={(el) => { sectionsRef.current['simulation-reasoning'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('simulation-reasoning') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="simulation-reasoning"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Simulation and Clinical Reasoning
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    Clinicians can explore potential interventions virtually: altering therapy parameters and observing projected responses across organs and time. As real-world data accumulates, STE refines its internal models and continuously improves fidelity and personalization. Through STE, we can scale clinical reasoning from an individual patient level to the hospital level, ultimately leading to the best possible decisions.
                  </p>
                </div>

                {/* Scaling Trust */}
                <div 
                  ref={(el) => { sectionsRef.current['scaling-trust'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('scaling-trust') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="scaling-trust"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Scaling Trust
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    STE solves one of the most important aspects of healthcare: trust. STE is designed from the ground up to meet emerging regulatory standards for responsible AI in medicine, and ensure we enhance the trust that exists between patients, healthcare workers, and the hospital systems.
                  </p>
              </div>

                {/* The Road Ahead */}
                <div 
                  ref={(el) => { sectionsRef.current['road-ahead'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('road-ahead') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="road-ahead"
                >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    The Road Ahead
              </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                   Our initial deployments focus on critical care, where decisions are most time-sensitive and data-rich. From there, the Somnium Twin Engine will extend to cardiology, oncology, longevity, and aerospace medicine — building the first universal and wholistic framework for human digital twins.
                  </p>
                </div>

                {/* Old Results Section - Keeping for reference but hidden */}
                <div 
                  ref={(el) => { sectionsRef.current.results = el; }}
                  className="mb-12 hidden"
                  id="results"
                >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Our results
              </h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    To achieve viable preservation, we first diffusively loaded 300 micron thick acute rat cerebellar slices with a cryoprotectant solution <strong>(Fig1a and Fig1b)</strong> whose composition is identical to the established VMP cryoprotectant <strong>(Han et al. 2023, Fahy et al. 2004)</strong> save the removal of one component <strong>(X-1000 ice blocker)</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    In preparation for cryopreservation, acute slices of rat cerebellum were placed in a multifunctional sample holder with a custom well for diffusive loading of cryoprotectant <strong>(Fig4)</strong>. The tissue was loaded with CPA, was rapidly cooled from 4ºC to -196ºC using a jet of liquid nitrogen <strong>(LN2)</strong>, and then was rewarmed using an alternating magnetic field from an induction heater <strong>(Fig1d and Fig1e)</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The sample holder's perfusion well was then placed back on top of the sample and cryoprotectant was unloaded using a linear ramp in perfused concentration into the well from the maximum CPA concentration to no CPA in 500 seconds. After ~45 minutes of post-cryopreservation incubation, the slices were transferred to a multielectrode array <strong>(3Brain Duplex)</strong> where activity was recorded at baseline before the addition of carbachol and the later addition of tetrodotoxin <strong>(Fig2)</strong>.
                  </p>
                  
                  {/* Figure 1 */}
                  <div className="my-8 bg-gray-50 rounded-lg p-6">
                    <div className="text-center mb-4">
                      <div className="text-lg font-semibold text-gray-900">Figure 1. Tissue Slice Cryopreservation Protocol.</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-600 space-y-2">
                        <p><strong>a)</strong> System Overview. Acute neural tissue is loaded with VPMnoX cryoprotectant (53% w/v cryoprotectants) before vitrification and rewarming using a specialized chamber. Activity is then recorded on a multielectrode array.</p>
                        <p><strong>b)</strong> CPA concentration as a function of time during cryoprotectant loading and unloading.</p>
                        <p><strong>c)</strong> Vitrification and magnetic rewarming.</p>
                        <p><strong>d)</strong> Cooling profile from the slice presented in Fig 2.</p>
                        <p><strong>e)</strong> Rewarming profile from the slice presented in Fig 2.</p>
                      </div>
                    </div>
                </div>
                
                  <p className="text-gray-700 leading-relaxed mb-4">
                    For N=4 slices tested with this protocol, activity was present and the signal responded as expected to pharmacology with carbachol increasing activity from baseline and tetrodotoxin silencing action potentials. In Figure 2, we present data from one of these slices <strong>(additional data available upon request, email hunter@untillabs.com)</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    At baseline, a number of electrodes detected high frequency spiking <strong>(Fig2b and Fig2c)</strong>. With application of carbachol to increase neural excitability, an increase in mean spike rate was observed. With tetrodotoxin application, spiking was blocked, confirming that the earlier signal represented physiological spiking.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    While neural activity was present in multiple MEA channels, it is clear that there is a marked reduction in electrical activity following this cryopreservation protocol. Sample data from a healthy control slice at baseline (no pharmacological stimulation) is shown in <strong>Fig2e</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    Of the 4 cryopreserved slices with maintained electrical activity, the slice depicted in <strong>Fig2</strong> showed no signs of macro cracking. Large thermal gradients applied across a volume of tissue after a phase change are likely to cause cracking. Future experiments will involve tuning the vitrification and rewarming profile aiming to completely avoid cracking while also cooling and warming fast enough to avoid damaging ice formation.
                  </p>

                  {/* Figure 2 */}
                  <div className="my-8 bg-gray-50 rounded-lg p-6">
                    <div className="text-center mb-4">
                      <div className="text-lg font-semibold text-gray-900">Figure 2. MEA Electrical Activity from Vitrified Slice.</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-600 space-y-2">
                        <p><strong>a)</strong> DAPI staining showing example morphology of a rat cerebellar slice after cryopreservation.</p>
                        <p><strong>b)</strong> Raster plot from a multi-electrode array recording of a vitrified and rewarmed cerebellar slice. Color changes indicate onset of pharmacology, and black signifies a region of electrodes not in contact with tissue to track global noise. Zoomed panel shows excerpts from highly active channels (6-10) for visual clarity.</p>
                        <p><strong>c)</strong> Mean firing rate for active areas in the same vitrified cerebellum slice as in (b), separated by pharmacology condition. Mean firing rate data from a separate healthy control slice is shown in gray.</p>
                        <p><strong>d)</strong> Representative raw signal traces from the same vitrified cerebellar slice as in (b) and (c). Red lines denote detected spikes.</p>
                        <p><strong>e)</strong> A representative raster plot showing high spiking activity from a healthy cerebellar slice being perfused with aCSF. Note time axis compared to (b).</p>
                        <p><strong>f)</strong> Same as (d), but for a healthy cerebellar slice.</p>
                      </div>
                    </div>
                </div>
              </div>

                {/* Contact Section */}
                <div className="bg-gradient-to-r from-stone-100 to-stone-200 rounded-xl p-8 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Have something to say?
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Email us at <a href="mailto:contact@somniumbio.com" className="text-blue-600 hover:text-blue-700 font-medium">contact@somniumbio.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      {/* <FooterNav 
        variant="technology"
        previousHref="/problem-statement"
        previousText="Problem Statement"
        nextHref="/founder-letter"
        nextText="Founder Letter"
      /> */}
      <Footer 
        variant="technology"
      />

      {/* Growing Gradient Line - Shows when scrolling */}
      {showBottomBar && !hideBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {/* Growing gradient line based on scroll progress */}
          <div className="px-12 py-4 bg-gradient-to-r from-white/10 via-gray-100/20 to-white/10">
            <div className="h-2 bg-gray-200/50 rounded-full relative overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-100 ease-out"
                style={{ 
                  width: `${scrollProgress}%`,
                  background: scrollProgress < 20 
                    ? 'linear-gradient(to right, #fca5a5, #ef4444)' // Light Red to Red
                    : scrollProgress < 40 
                    ? 'linear-gradient(to right, #fca5a5, #f97316)' // Light Red to Orange
                    : scrollProgress < 60 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047)' // Light Red to Orange to Light Yellow
                    : scrollProgress < 80 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac)' // Light Red to Orange to Light Yellow to Light Green
                    : 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac, #93c5fd)' // Full gradient with lighter colors
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
