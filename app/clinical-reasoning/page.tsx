'use client';

import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import FooterNav from '../components/FooterNav';
import Navigation from '../components/Navigation';
import { LiquidButton } from '../components/ui/liquid-glass-button';

export default function ProblemStatement() {
  const [activeSection, setActiveSection] = useState('the-problem');
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
      
      setShowBottomBar(scrollPosition > blueSectionHeight);
      
      const footerThreshold = documentHeight - windowHeight - 200;
      setHideBottomBar(scrollPosition >= footerThreshold);
      
      if (scrollPosition > blueSectionHeight && scrollPosition < footerThreshold) {
        const contentScrollPosition = scrollPosition - blueSectionHeight;
        const contentHeight = footerThreshold - blueSectionHeight;
        const contentScrollPercentage = (contentScrollPosition / contentHeight) * 100;
        setScrollProgress(Math.min(contentScrollPercentage, 100));
      } else {
        setScrollProgress(0);
      }
      
      if (scrollPosition <= blueSectionHeight) {
        setActiveSection('the-problem');
        return;
      }
      
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
    { id: 'clinical-reasoning', title: 'Clinical Reasoning' },
    { id: 'the-problem', title: 'The Problem' },
    { id: 'how-we-solve-it', title: 'How We Solve It' },
    { id: 'outcomes', title: 'Outcomes' },
    { id: 'towards-ai-clinician', title: 'Towards an AI Clinician' },
    { id: 'get-started', title: 'Get Started' }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navigation />
      
      <section className="py-20 text-white relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/r1.jpg)' }}
        ></div>
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute inset-0 backdrop-blur-sm bg-white/10"></div>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-6 mt-20">
            Clinical Reasoning
          </h1>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
            <LiquidButton variant="problem-statement" size="sm">
              Reasoning
            </LiquidButton>
            <LiquidButton variant="problem-statement" size="sm">
              Uncertainty
            </LiquidButton>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-red-100 max-w-3xl mx-auto leading-relaxed">
            Building AI that thinks and reasons like a clinician — grounded in physiology, scalable across healthcare.
          </p>
        </div>
      </section>

      <section className="relative bg-stone-50">
        <div className="pb-20">
          <div className="flex relative">
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

            <div className="flex-1 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
              <div className="prose prose-lg max-w-none">
                
                <div className="mb-12">
                  <p className="text-gray-700 leading-relaxed text-lg">
                    At Somnium Biolabs, we believe that the future of medicine isn't just smarter algorithms—it's clinical intelligence. Intelligence that reasons, deduces, infers, and acts with context, precision, and purpose. Most AI models predict, and in the face of uncertainty, they hallucinate. They don't reason. They see patterns, but they don't understand patients in their full context. Clinical reasoning — the ability to connect symptoms, data, and physiology into causal logic — has been missing from healthcare AI. Until now.
                  </p>
                </div>

                <div 
                  ref={(el) => { sectionsRef.current['the-problem'] = el; }}
                  className="mb-12"
                  id="the-problem"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    The Problem
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-lg mb-4">
                    In today's healthcare AI landscape, many models generate predictions (e.g., risk of complication, probability of disease, etc.), but few truly reason like a clinician does: integrating multimodal data, understanding causality, simulating outcomes, and updating hypotheses over time. Clinical decision-making remains fragmented: siloed data from EHRs, imaging, genomics; disparate AI tools; limited interpretability; high cost of deployment; uncertain validation; and poor generalizability across populations. The result: slower diagnoses, sub-optimal treatment choices, wasted resources, and higher overall costs, with poorer patient outcomes.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    Real clinical intelligence requires context: how and why things happen inside the body, not just what correlates. Without reasoning, AI remains an assistant, not a real clinician.
                  </p>
                </div>

                <div 
                  ref={(el) => { sectionsRef.current['how-we-solve-it'] = el; }}
                  className="mb-12"
                  id="how-we-solve-it"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    How We Solve It
                  </h2>
                  
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Real-world grounding via the Virtual Physiological Human
                    </h3>
                    <p className="text-gray-700 leading-relaxed text-lg mb-4">
                      We built a physiology-first foundation that grounds every decision in biological reality.
                    </p>
                    <p className="text-gray-700 leading-relaxed text-lg">
                      Our Somnium Twin Engine fuses real-world data, digital twins, and generative simulation — enabling models to think causally, not statistically.
                    </p>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      New AI infrastructure
                    </h3>
                    <p className="text-gray-700 leading-relaxed text-lg mb-4">
                      <strong>Vendor-agnostic architecture:</strong> Our API-first infrastructure allows plug-in of existing specialized AI models (imaging, pathology, cardiology) into the Digital Twin environment where they gain context, benefited by our physiological and reasoning layer.
                    </p>
                    
                    <div className="bg-gray-100 rounded-lg p-6 my-8">
                      <ul className="space-y-3 text-gray-700">
                        <li><strong>Unified representation:</strong> By converting heterogeneous data into a physiologic representation, disparate models speak the same "language" — enabling synergy, ensemble-reasoning and reduced model brittleness.</li>
                        <li><strong>Continuous learning & feedback:</strong> As patient outcomes are observed, the system adjusts its digital twin, retrains models, tightening predictions, refining reasoning pathways and improving performance over time.</li>
                        <li><strong>Cost-effective scaling:</strong> Simulation enables in-silico testing, reducing expensive clinical trial iterations. OEM models gain access to a richer context with less custom data engineering needed.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div 
                  ref={(el) => { sectionsRef.current['outcomes'] = el; }}
                  className="mb-12"
                  id="outcomes"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Outcomes
                  </h2>
                  
                  <div className="bg-gray-100 rounded-lg p-6 my-8">
                    <ul className="space-y-3 text-gray-700">
                      <li><strong>Better model performance:</strong> By embedding your native AI models within our physiologic reasoning framework, we reduce false positives/negatives, improve calibration through real-world grounding, and support interpretability ("why did the model reach this decision?").</li>
                      <li><strong>Improved patient outcomes:</strong> Clinicians receive decision support not just as probability scores, but as scenario-based reasoning: "Given this patient's twin state, simulation shows 45% reduction in complication with treatment X in 4 weeks versus 27% with treatment Y".</li>
                      <li><strong>Reduced cost:</strong> Fewer unnecessary tests, fewer mistreatments, faster decision pathways, and lower development/deployment overhead for AI models. Simulation means fewer costly human trials; reusable infrastructure means lower build-time for new AI tools.</li>
                      <li><strong>Accessible via API:</strong> Third-party developers and healthcare enterprises can call our Clinical Reasoning API to embed intelligent decision-support, plug into existing workflows, and scale across patients, wards, or populations.</li>
                    </ul>
                  </div>
                </div>

                <div 
                  ref={(el) => { sectionsRef.current['towards-ai-clinician'] = el; }}
                  className="mb-12"
                  id="towards-ai-clinician"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Towards an AI Clinician
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-lg mb-4">
                    We are building a future where we combine the strengths of human clinicians with the power of AI. Any healthcare provider can invoke a simple Clinical Reasoning API and access a digital colleague — an expert AI clinician that reasons with you, not just for you.
                  </p>
                  
                  <div className="bg-gray-100 rounded-lg p-6 my-8">
                    <ul className="space-y-3 text-gray-700">
                      <li>It presents why a diagnosis is likely, how a treatment path will evolve, what alternate strategies could be effective, and what the predicted outcome will be with quantified confidence.</li>
                      <li>It continuously learns from patient reality, hospital outcomes, clinical trials, and biologic data — getting smarter with every case.</li>
                      <li>It enables leaner operations: hospitals can optimize resource allocation, clinics can provide personalized guidance, and payors can measure real-world value more reliably.</li>
                    </ul>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed text-lg">
                    Ultimately, a world where clinical reasoning is democratized, cost is no longer a barrier, and every patient has access to smarter, safer, more personalized care.
                  </p>
                </div>

                <div 
                  ref={(el) => { sectionsRef.current['get-started'] = el; }}
                  className="mb-12"
                  id="get-started"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Get Started
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-lg mb-4">
                    Ready to transform how your organization thinks and practices medicine? Contact us to explore our Clinical Reasoning API, pilot engagements, and transformative workflows: <a href="mailto:contact@somniumbio.com" className="text-blue-600 hover:text-blue-700 font-medium underline">contact@somniumbio.com</a>.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-lg font-semibold">
                    Let's build the clinician of the future — today.
                  </p>
                </div>

                {/* <div className="bg-gradient-to-r from-stone-100 to-stone-200 rounded-xl p-8 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Ready to transform healthcare with clinical reasoning?
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Contact us at <a href="mailto:contact@somniumbio.com" className="text-blue-600 hover:text-blue-700 font-medium underline">contact@somniumbio.com</a>
                  </p>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer variant="problem-statement" />

      {showBottomBar && !hideBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="px-12 py-4 bg-gradient-to-r from-white/10 via-gray-100/20 to-white/10">
            <div className="h-2 bg-gray-200/50 rounded-full relative overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-100 ease-out"
                style={{ 
                  width: `${scrollProgress}%`,
                  background: scrollProgress < 20 
                    ? 'linear-gradient(to right, #fca5a5, #ef4444)'
                    : scrollProgress < 40 
                    ? 'linear-gradient(to right, #fca5a5, #f97316)'
                    : scrollProgress < 60 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047)'
                    : scrollProgress < 80 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac)'
                    : 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac, #93c5fd)'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
