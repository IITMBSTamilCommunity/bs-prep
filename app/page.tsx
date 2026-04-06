"use client"

import Link from "next/link"
import { useState, Suspense } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { BookOpen, Users, TrendingUp, ArrowRight, ChevronDown, Video, MessageCircle } from "lucide-react"
import CardSwap, { Card as SwapCard } from "@/components/card-swap"

const spinner = <div className="animate-spin w-6 h-6 border-2 border-gray-200 border-t-black rounded-full" />

// Lazy load heavy / interaction-only components
const StaggerTestimonials = dynamic(() => import("@/components/stagger-testimonials").then(mod => ({ default: mod.StaggerTestimonials })), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center">{spinner}</div>
})

const LoginModal = dynamic(() => import("@/components/auth/login-modal").then(mod => ({ default: mod.LoginModal })), {
  ssr: false,
  loading: () => null
})

const SignUpModal = dynamic(() => import("@/components/auth/signup-modal").then(mod => ({ default: mod.SignUpModal })), {
  ssr: false,
  loading: () => null
})

const AnimatedCounter = dynamic(() => import("@/components/animated-counter").then(mod => ({ default: mod.AnimatedCounter })), {
  ssr: false,
  loading: () => <span className="text-4xl md:text-5xl font-bold text-black">—</span>
})

export default function HomePage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  
  const heroRef = useScrollReveal<HTMLElement>({ threshold: 0.1 })
  const statsRef = useScrollReveal<HTMLDivElement>({ threshold: 0.2 })
  const howItWorksRef = useScrollReveal<HTMLElement>({ threshold: 0.15 })
  const coursesRef = useScrollReveal<HTMLElement>({ threshold: 0.1 })
  const whyChooseRef = useScrollReveal<HTMLElement>({ threshold: 0.1 })
  const ctaRef = useScrollReveal<HTMLElement>({ threshold: 0.2 })
  const faqRef = useScrollReveal<HTMLElement>({ threshold: 0.1 })

  const courseCards = [
    { image: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-1.png", title: "Mathematics for Data Science I" },
    { image: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-2.png", title: "Statistics for Data Science I" },
    { image: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-3.png", title: "Computational Thinking" }
  ]

  const faqs = [
    {
      question: "What is BSPrep?",
      answer: "BSPrep is a community-driven learning platform designed to help IITM BS students prepare better through structured courses, quizzes, and mentor support."
    },
    {
      question: "Is BSPrep officially affiliated with IIT Madras?",
      answer: "No. BSPrep is not officially affiliated with IIT Madras. It is an independent, student-led initiative."
    },
    {
      question: "How can I contact BSPrep?",
      answer: "You can contact us through the Support page on the website or by emailing bsprep.team@gmail.com"
    }
  ]

  return (
    <div className="min-h-screen text-foreground">
      <Navbar isAuthenticated={false} />

      <section ref={heroRef.ref} className={`relative overflow-hidden pt-10 md:pt-16 pb-10 md:pb-16 transition-all duration-1000 ${heroRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-8 items-center mb-8">
            {/* Left Column: Content */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                <span className="block mb-3 bg-gradient-to-r from-black to-black/80 bg-clip-text text-transparent">Learn IITM BS</span>
                <span className="block bg-gradient-to-r from-black to-black/80 bg-clip-text text-transparent">
                  With Mentors by Your Side
                </span>
              </h1>

              <p className="text-lg md:text-xl text-black/70 leading-relaxed">
                Expert-led learning in Tamil, community support, and peer mentorship for IITM BS students. Master concepts, solve
                doubts, and ace your exams with our comprehensive platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button
                  onClick={() => setShowLogin(true)}
                  className="bg-white text-black px-8 py-6 text-lg rounded-full border-2 border-gray-300 hover:border-black transition-all duration-300 font-medium"
                >
                  Sign In
                </Button>
                <Link href="https://docs.google.com/forms/d/e/1FAIpQLSfyhCw9tPgKmMWYPhjV6Kzixp2RdYEi-x7JPL6JUxoLwbnB_g/viewform?usp=sharing&ouid=109000575421815991569" target="_blank" rel="noopener noreferrer">
                  <Button className="group bg-black text-white hover:bg-black/90 px-8 py-6 text-lg rounded-full transition-all duration-300 shadow-md hover:shadow-lg font-medium">
                    Join Community
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Animated Card Stack */}
            <div className="hidden md:block relative h-[330px]">
              <CardSwap
                width={630}
                height={400}
                cardDistance={60}
                verticalDistance={70}
                delay={2800}
                pauseOnHover={false}
              >
                <SwapCard>
                  <img
                    src="https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-1.png"
                    alt="Mathematics for Data Science I"
                    className="w-full h-full object-cover"
                  />
                </SwapCard>
                <SwapCard>
                  <img
                    src="https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-2.png"
                    alt="Statistics for Data Science I"
                    className="w-full h-full object-cover"
                  />
                </SwapCard>
                <SwapCard>
                  <img
                    src="https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/hero-section/image-3.png"
                    alt="Computational Thinking"
                    className="w-full h-full object-cover"
                  />
                </SwapCard>
              </CardSwap>
            </div>

            {/* Mobile: Horizontal Swipe Carousel */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              <div className="flex gap-4 pb-4">
                {courseCards.map((card, index) => (
                  <div key={index} className="snap-center shrink-0 w-[85vw]">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200 h-80">
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div ref={statsRef.ref} className={`grid grid-cols-3 gap-4 md:gap-8 mt-8 transition-all duration-1000 delay-300 ${statsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {[
              { label: "Active Students", value: 100, suffix: "+" },
              { label: "Expert Mentors", value: 15, suffix: "+" },
              { label: "Study Materials", value: 500, suffix: "+" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white backdrop-blur-sm rounded-2xl p-6 md:p-8 text-center hover:shadow-lg transition-all duration-300 cursor-default border border-gray-200"
              >
                <p className="text-2xl md:text-3xl font-bold text-black">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={2500} />
                </p>
                <p className="text-sm text-black/70 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={howItWorksRef.ref} className={`relative py-12 md:py-16 transition-all duration-1000 ${howItWorksRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-4">How It Works</h2>
            <p className="text-black/70 text-lg">Three simple steps to transform your learning</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                number: "01",
                title: "Purchase our Tamil Courses",
                description: "Get exclusive access to comprehensive live video lectures covering all IITM BS subjects in Tamil",
                icon: BookOpen,
              },
              {
                number: "02",
                title: "Join Live Mentoring Sessions",
                description: "Interact with expert mentors, ask questions, and get personalized guidance to master concepts and solve doubts",
                icon: Users,
              },
              {
                number: "03",
                title: "Crack the Qualifier Exam",
                description: "Using our structured courses and mentor support, confidently prepare for and ace the IITM BS Qualifier exam",
                icon: TrendingUp,
              },
            ].map((step, i) => (
              <div
                key={i}
                className="relative bg-white backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg"
              >
                <div className="text-5xl font-bold text-gray-200 mb-4">
                  {step.number}
                </div>
                <step.icon className="w-10 h-10 text-black mb-4" />
                <h3 className="text-xl font-bold text-black mb-3">{step.title}</h3>
                <p className="text-black/70">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={coursesRef.ref} className={`relative py-12 md:py-16 bg-gradient-to-b from-gray-50 to-white transition-all duration-1000 ${coursesRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-4">Crack Qualifier with Tamil Courses</h2>
            <p className="text-black/70 text-lg mb-2">Master IITM BS Qualifier level with comprehensive Tamil video courses</p>
            <div className="inline-flex items-stretch mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Per course */}
              <div className="flex flex-col items-center justify-center px-8 py-4 gap-0.5">
                <span className="text-xs font-medium text-black/40 uppercase tracking-widest mb-1">Per Course</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-black/35 line-through">₹499</span>
                  <span className="text-3xl font-extrabold text-black leading-none">₹99</span>
                </div>
                <span className="mt-1 text-[11px] bg-black text-white rounded-full px-2.5 py-0.5 font-semibold tracking-wide">80% OFF</span>
              </div>
              {/* Divider */}
              <div className="w-px bg-gray-200 my-3" />
              {/* Bundle */}
              <div className="flex flex-col items-center justify-center px-8 py-4 gap-0.5">
                <span className="text-xs font-medium text-black/40 uppercase tracking-widest mb-1">All 3 Courses</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-[#51b206]/50 line-through">₹1497</span>
                  <span className="text-3xl font-extrabold text-[#51b206] leading-none">₹249</span>
                </div>
                <span className="mt-1 text-[11px] bg-[#51b206] text-white rounded-full px-2.5 py-0.5 font-semibold tracking-wide">Best Value</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              {
                id: "qualifier-math-1",
                title: "Mathematics for Data Science I",
                description: "Master fundamental math concepts",
                thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/math.png",
                price: 99, originalPrice: 499
              },
              {
                id: "qualifier-stats-1",
                title: "Statistics for Data Science I",
                description: "Learn statistical thinking & analysis",
                thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/stats.png",
                price: 99, originalPrice: 499
              },
              {
                id: "qualifier-computational-thinking",
                title: "Computational Thinking",
                description: "Build problem-solving skills",
                thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/ct.png",
                price: 99, originalPrice: 499
              }
            ].map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="group">
                <Card className="bg-white border border-gray-200 hover:border-gray-400 transition-all duration-200 hover:shadow-lg rounded-lg h-full overflow-hidden">
                  <div className="relative w-full aspect-video overflow-hidden">
                    <img 
                      src={course.thumbnail} 
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-5">
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">IITM BS</span>
                    </div>
                    <h3 className="text-lg font-bold text-black mb-2 line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {course.description}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Price</span>
                      <div className="flex items-center gap-2">
                        {course.originalPrice && (
                          <span className="text-sm text-gray-400 line-through">₹{course.originalPrice}</span>
                        )}
                        <span className="text-xl font-bold text-black">₹{course.price}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link href="/courses">
              <Button className="bg-black text-white hover:bg-black/90 px-8 py-4 rounded-full transition-all duration-300 font-medium">
                View All Courses
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section ref={whyChooseRef.ref} className={`relative py-12 md:py-16 transition-all duration-1000 ${whyChooseRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-4">Why Choose BSPrep?</h2>
            <p className="text-black/70 text-lg">Built for Tamil-speaking IITM BS students</p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Hero card — Tamil-first, spans 2 cols */}
            <div className="md:col-span-2 bg-black text-white rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-2xl transition-all duration-300">
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="bg-white/15 text-white text-xs px-3 py-1.5 rounded-full font-medium tracking-wide">Tamil Medium</span>
                <span className="bg-white/15 text-white text-xs px-3 py-1.5 rounded-full font-medium tracking-wide">Expert Mentors</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-snug">Explained in Tamil.<br/>Understood in Minutes.</h3>
                <p className="text-white/65 text-base leading-relaxed max-w-lg">We break down complex IITM BS concepts in Tamil — so you actually get it, not just memorize it. Our mentors speak your language.</p>
              </div>
            </div>

            {/* Live Weekly Classes */}
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 flex flex-col justify-between min-h-[220px] hover:border-gray-400 hover:shadow-lg transition-all duration-300">
              <div>
                <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center mb-4">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-xl text-black mb-1">Live Weekly Classes</h3>
                <p className="text-black/55 text-sm leading-relaxed">Join live sessions with Tamil-speaking mentors every week — ask doubts, follow along, stay on track.</p>
              </div>
              <div className="flex gap-1.5 mt-5">
                {["M","T","W","T","F","S","S"].map((d, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    [1, 3, 5].includes(i) ? "bg-black text-white" : "bg-gray-200 text-gray-400"
                  }`}>{d}</div>
                ))}
              </div>
            </div>

            {/* Study Materials */}
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 flex flex-col min-h-[190px] hover:border-gray-400 hover:shadow-lg transition-all duration-300">
              <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-xl text-black mb-1">Study Materials</h3>
              <p className="text-black/55 text-sm mb-4 leading-relaxed">Curated notes, PDF guides, and resources for every subject.</p>
              <div className="mt-auto flex items-end gap-1">
                <span className="text-4xl font-extrabold text-black leading-none">500+</span>
                <span className="text-sm text-black/45 mb-1">resources</span>
              </div>
            </div>

            {/* Community — spans 2 cols, black */}
            <div className="md:col-span-2 bg-black text-white rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center gap-6 min-h-[190px] hover:shadow-2xl transition-all duration-300">
              <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-1">Tamil Peer Community</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-md">Ask doubts, share notes, and study together with thousands of Tamil-speaking IITM BS students across all terms.</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-5xl font-extrabold text-white leading-none block">500+</span>
                <span className="text-sm text-white/45">students</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      <StaggerTestimonials />

      <section ref={ctaRef.ref} className={`relative py-12 md:py-16 transition-all duration-1000 ${ctaRef.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center bg-white backdrop-blur-sm rounded-3xl p-12 md:p-16 border border-gray-200 shadow-lg">
          <h2 className="text-3xl md:text-5xl font-bold text-black mb-6">Ready to Transform Your Learning?</h2>
          <p className="text-black/70 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of IITM BS students accelerating their journey with expert mentorship and community support.
          </p>
          <Button
            onClick={() => setShowLogin(true)}
            className="group bg-black text-white hover:bg-black/90 px-12 py-7 text-lg rounded-full transition-all duration-300 shadow-md hover:shadow-lg font-medium"
          >
            Get Started
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      <LoginModal
        open={showLogin}
        onOpenChange={setShowLogin}
        onSwitchToSignUp={() => { setShowLogin(false); setShowSignup(true) }}
        onSwitchToForgotPassword={() => {}}
      />
      <SignUpModal
        open={showSignup}
        onOpenChange={setShowSignup}
        onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true) }}
      />

      <section ref={faqRef.ref} className={`relative py-12 md:py-16 bg-gradient-to-b from-transparent to-gray-50 transition-all duration-1000 ${faqRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-black/70 text-lg">
              Everything you need to know about BSPrep
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-gray-300"
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
                >
                  <h3 className="text-lg md:text-xl font-semibold text-black pr-8">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`w-6 h-6 text-black/70 flex-shrink-0 transition-transform duration-300 ${
                      openFAQ === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFAQ === index ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <div className="px-6 pb-6 text-black/70 text-base md:text-lg leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-black/70 mb-4">Still have questions?</p>
            <Link href="/support">
              <Button className="bg-black text-white hover:bg-black/90 px-8 py-4 rounded-full transition-all duration-300 font-medium">
                Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

