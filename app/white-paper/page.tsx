'use client';

import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import FooterNav from '../components/FooterNav';

export default function WhitePaper() {
  const [activeSection, setActiveSection] = useState('abstract');
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
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
        setActiveSection('abstract');
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

  const scrollToSection = (sectionId: string) => {
    const element = sectionsRef.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sections = [
    { id: 'abstract', title: 'Abstract' },
    { id: 'main', title: 'Main' },
    { id: 'results', title: 'Our results' },
    { id: 'discussion', title: 'Discussion' },
    { id: 'methods', title: 'Methods' },
    { id: 'citations', title: 'Citations' }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header Section - Scrolls naturally */}
      <section className="py-20 bg-gradient-to-b from-blue-600 via-blue-500 to-blue-400 text-white relative overflow-hidden">
        {/* Noise/Texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="mb-4">
            <span className="text-sm font-medium text-blue-100">
              Background for Milestone White Paper I
            </span>
          </div>
          <div className="text-sm text-blue-200 mb-6">
            September 22, 2025
          </div>
          <div className="text-sm text-blue-200 mb-6">
            The Until Team by The Until Team
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold mb-6">
            Milestone White Paper I
          </h1>
          <div className="flex justify-center gap-4 mb-6">
            <span className="text-sm font-medium text-blue-100 bg-blue-500/30 px-3 py-1 rounded-full">
              Progress Update
            </span>
            <span className="text-sm font-medium text-blue-100 bg-blue-500/30 px-3 py-1 rounded-full">
              Neuroscience
            </span>
          </div>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Recovery of electrical activity from cryopreserved and rewarmed acutely resected rodent neural tissue
          </p>
        </div>
      </section>

      {/* Scrollable Main Content */}
      <section className="relative bg-stone-50">
        <div className="pb-20">
          <div className="flex relative">
            {/* Left Sidebar Navigation - Sticky to white content area */}
            <div className="sticky top-48 left-0 h-fit z-40 pl-8 mr-8 pt-8">
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
            <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="prose prose-lg max-w-none">
                
                {/* Abstract */}
                <div 
                  ref={(el) => { sectionsRef.current.abstract = el; }}
                  className="mb-12"
                  id="abstract"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Abstract
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Cryopreservation is a widely used technique for the storage of isolated neural cells and has recently been demonstrated to maintain electrical activity in simple neural organoids. However, recovery of action potentials from cryopreserved acutely resected neural tissue remains an ongoing challenge for the field.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    Here, we cryopreserve and rewarm acutely resected rat cerebellar slices, demonstrating electrical activity after rewarming. This is, to our knowledge, the first report of recovery of electrical activity in acutely resected mammalian brain tissue with accompanying protocols for validation and replication.
                  </p>
                </div>

                {/* Main */}
                <div 
                  ref={(el) => { sectionsRef.current.main = el; }}
                  className="mb-12"
                  id="main"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Main
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Cryopreservation of isolated cells is a ubiquitous technique that is required for the storage and shipment of primary neural progenitor cells <strong>(Hancock et al, 2000)</strong>. While neurons derived from these cells can provide some insights into single-cell biophysics and electrophysiology, their electrical activity is fundamentally different from neurons in the context of native microcircuits.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    For this reason, much neuroscience research is focused either in living organisms or in acute slices of tissue. Acute slices conveniently allow for electrical access to deep brain regions while maintaining much of the connectivity between cells <strong>(Frey et al, 2009)</strong>. Given the difficulty in quickly accessing and maintaining the viability of human brain tissue for research use, the vast majority of these experiments are performed on murine tissue, limiting translatability <strong>(Day et al, 2013)</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    An effective method for cryopreservation of acutely resected neural tissue from human donors would enable cryostorage and shipment of these valuable research samples, unlocking a new platform for basic neuroscience research and drug development. Recently, a protocol for successful cryopreservation of lab-grown brain organoids was shown, with impressive maintenance of structure and electrical activity after rewarming <strong>(Xue et al, 2024)</strong>. However, the study did not demonstrate electrical activity in their cryopreserved sample of acutely resected neural tissue.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-6">
                    Organoids, while invaluable for modeling aspects of disease and early brain development, face limitations compared to acute tissue slices, such as a lack of mature cellular organization and functional connectivity, which can impact their translational relevance in neuroscience research <strong>(Qian & Song, 2019)</strong>.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    Here, we present a method for cryopreservation of acute slices of rat cerebellar tissue, showing recovery of some electrical activity after cryopreservation and rewarming. This is, to our knowledge, the first demonstration of action potentials in cryopreserved and rewarmed acutely resected neural tissue.
                  </p>
                </div>

                {/* Our results */}
                <div 
                  ref={(el) => { sectionsRef.current.results = el; }}
                  className="mb-12"
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

                {/* Discussion */}
                <div 
                  ref={(el) => { sectionsRef.current.discussion = el; }}
                  className="mb-12"
                  id="discussion"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Discussion
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Here, we demonstrate recovery of electrical activity in previously cryopreserved acute rodent neural tissue. Due to the high viscosity of vitrified water, bringing a sample to LN2 temperature (-196ºC) allows for virtually indefinite storage due to the extreme slowing of molecular motion, stopping metabolism and preventing ice formation.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The finding that neural tissue can reach LN2 temperature and be rewarmed to recover electrical activity marks an important milestone on the trajectory to an acute slice preservation protocol appropriate for the storage of acutely resected human tissue for research applications.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Iterations and improvements to this protocol will be necessary to achieve a level of preservation and functional viability required for translatable research using this method. Continued screening of highly effective and minimally toxic CPA formulations specifically targeted for neural tissue will enable improved viability.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Our next aim along this trajectory is to apply novel neural CPAs and thermal control protocols to demonstrate synaptic function and long-term potentiation (LTP) in an acute slice following cryopreservation, moving towards effective cryopreservation of slices that more closely resemble healthy controls.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    Additionally, this work sheds light on the possibility of whole body reversible cryopreservation, which would enable medical hibernation to halt the progression of terminal diseases showing promise of a cure in the foreseeable future. We predict that neural tissue will pose a particular challenge compared to other organs due to limited capacity for regeneration, low redundancy, high osmotic sensitivity, and the presence of the blood brain barrier which may limit uptake of cryoprotective agents.
                  </p>
                </div>

                {/* Methods */}
                <div 
                  ref={(el) => { sectionsRef.current.methods = el; }}
                  className="mb-12"
                  id="methods"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Methods
                  </h2>
                  
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">Cryoprotectant Loading</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Acute cerebellar slices were loaded with VMPnoX cryoprotectant solution (53% w/v cryoprotectants) through a controlled diffusion process. The tissue was placed in a multifunctional sample holder with a custom well for diffusive loading of cryoprotectant.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-3">Vitrification Protocol</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Tissue samples were rapidly cooled from 4ºC to -196ºC using a jet of liquid nitrogen (LN2). Cooling rates of 1140 ºC/min were achieved for the slices reported in the study. A thermocouple placed next to the slice was monitored, and LN2 flow was maintained for 30 seconds after minimum temperature had been reached.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-3">AMF Rewarming</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    After holding at -196ºC for 1 minute, flow of LN2 was halted and the sample was quickly rewarmed using an AMF electromagnet operating at 15W field strength and ~70kHz frequency. A rate of 1280 ºC/min was reached for the slice reported in the study.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-3">CPA Unloading</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    After rewarming, the vitrification hat was removed and the perfusion hat was re-installed. The CPA unloading protocol included a 500 second linear ramp from 53% to 0% w/v CPA, followed by 10 minutes of 0% w/v CPA.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-3">MEA Slice Electrophysiology</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Viability in tissue slices was evaluated by multi-electrode array electrophysiology using the 3Brain BioCAM DupleX system. The 3Brain HD-MEA Acura 2D chip model was used, with 4,096 electrodes in a working area of 3.84mm x 3.84mm. Recordings were acquired with 20kHz sampling frequency.
                  </p>
                </div>

                {/* Citations */}
                <div 
                  ref={(el) => { sectionsRef.current.citations = el; }}
                  className="mb-12"
                  id="citations"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Citations
                  </h2>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p><strong>Day, B., Stringer, B., Wilson, J., Jeffree, R., Jamieson, P., Ensbey, K., Bruce, Z., Inglis, P., Allan, S., Winter, C., Tollesson, G., Campbell, S., Lucas, P., Findlay, W., Kadrian, D., Johnson, D., Robertson, T., Johns, T., Bartlett, P., Osborne, G., & Boyd, A.</strong> (2013). Glioma Surgical Aspirate: A Viable Source of Tumor Tissue for Experimental Research. Cancers, 5, 357 - 371.</p>
                    
                    <p><strong>Fahy GM, Wowk B, Wu J, Phan J, Rasch C, Chang A, Zendejas E.</strong> Cryopreservation of organs by vitrification: perspectives and recent advances. Cryobiology. 2004 Apr;48(2):157-78.</p>
                    
                    <p><strong>Frey, U., Egert, U., Heer, F., Hafizovic, S., & Hierlemann, A.</strong> (2009). Microelectronic system for high-resolution mapping of extracellular electric fields applied to brain slices. Biosensors & bioelectronics, 24 7, 2191-8.</p>
                    
                    <p><strong>Han, Z., Rao, J.S., Gangwar, L. et al.</strong> Vitrification and nanowarming enable long-term organ cryopreservation and life-sustaining kidney transplantation in a rat model. Nat Commun 14, 3407 (2023).</p>
                    
                    <p><strong>Hancock, C., Wetherington, J., Lambert, N., & Condie, B.</strong> (2000). Neuronal differentiation of cryopreserved neural progenitor cells derived from mouse embryonic stem cells. Biochemical and biophysical research communications, 271 2, 418-21.</p>
                    
                    <p><strong>Maccione, A., Gandolfo, M., Massobrio, P., Novellino, A., Martinoia, S., & Chiappalone, M.</strong> (2009). A novel algorithm for precise identification of spikes in extracellularly recorded neuronal signals. Journal of Neuroscience Methods, 177(1), 241–249.</p>
                    
                    <p><strong>Xue W, Li H, Xu J, Yu X, Liu L, Liu H, Zhao R, Shao Z.</strong> (2024) Effective cryopreservation of human brain tissue and neural organoids. Cell Reports Methods. May; 4(5).</p>
                    
                    <p><strong>Qian X, Song H, Ming GL.</strong> Brain organoids: advances, applications and challenges. Development. 2019 Apr 16;146(8):dev166074.</p>
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
      <FooterNav 
        variant="white-paper"
        previousHref="/problem-statement"
        previousText="Problem Statement"
        nextHref="/founder-letter"
        nextText="Founder Letter"
      />
      <Footer 
        variant="white-paper"
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