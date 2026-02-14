import { Button } from '@credopass/ui/components/button';
import { Card } from '@credopass/ui/components/card';
import { Badge } from '@credopass/ui/components/badge';
import { useTheme } from '@credopass/lib/theme';
import {
  QrCode,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Shield,
  Globe,
  Award,
  Moon,
  Sun,
  Sparkles,
  LineChart,
  UserCheck,
  Smartphone,
  Database,
  Zap,
  BarChart3,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useState, useEffect, useRef, type ReactNode } from 'react';

/* ----------------------------------------------------------------
   Scroll-reveal hook: fades + slides children in when visible
   ---------------------------------------------------------------- */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPricing] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigateToApp = () => {
    location.href = 'https://app.credopass.com';
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============================================================
          NAVIGATION
          ============================================================ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-border/30 bg-background/70 backdrop-blur-2xl backdrop-saturate-150 shadow-sm' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(212,255,0,0.3)]">
                <QrCode className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg tracking-tight">CredoPass</span>
            </div>

            <div className="hidden lg:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#product" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Product</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#customers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Customers</a>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <button onClick={toggleTheme} className="p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <Button variant="ghost" size="sm" className="text-sm">Sign In</Button>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm rounded-lg shadow-[0_0_16px_rgba(212,255,0,0.2)]">
                Get Started <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex lg:hidden items-center gap-2">
              <button onClick={toggleTheme} className="p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
            <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
              <a href="#features" className="py-2 text-sm text-muted-foreground hover:text-foreground">Features</a>
              <a href="#product" className="py-2 text-sm text-muted-foreground hover:text-foreground">Product</a>
              <a href="#pricing" className="py-2 text-sm text-muted-foreground hover:text-foreground">Pricing</a>
              <a href="#customers" className="py-2 text-sm text-muted-foreground hover:text-foreground">Customers</a>
              <div className="pt-4 flex flex-col gap-2">
                <Button variant="outline" className="w-full" size="sm">Sign In</Button>
                <Button className="w-full bg-primary text-primary-foreground" size="sm">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/8 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[96px]" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
            {/* Animated badge */}
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-foreground font-medium">Trusted by 10,000+ organizations</span>
              </div>
            </Reveal>

            {/* Headline */}
            <Reveal delay={100}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.02] text-balance">
                Track who{' '}
                <span className="relative inline-block">
                  <span className="text-primary">actually shows up</span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" aria-hidden="true">
                    <path d="M2 8.5C50 2.5 100 2 150 5.5C200 9 250 4.5 298 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/40" />
                  </svg>
                </span>
                , not just who signed up
              </h1>
            </Reveal>

            {/* Subheadline */}
            <Reveal delay={200}>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                The modern attendance management system for organizations that need real engagement data. Works alongside your existing tools.
              </p>
            </Reveal>

            {/* CTA Buttons */}
            <Reveal delay={300}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 h-12 shadow-[0_0_32px_rgba(212,255,0,0.25)] hover:shadow-[0_0_48px_rgba(212,255,0,0.4)] transition-all duration-300 hover:-translate-y-0.5" onClick={navigateToApp}>
                  Start For Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 hover:border-primary/40 transition-all duration-300">
                  View Demo
                </Button>
              </div>
            </Reveal>

            {/* Trust Indicators */}
            <Reveal delay={400}>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Free Hobby Plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Hero Image */}
          <Reveal delay={500}>
            <div className="max-w-6xl mx-auto mt-16 lg:mt-24">
              <div className="relative">
                {/* Glow behind screenshot */}
                <div className="absolute -inset-4 bg-gradient-to-t from-primary/15 via-primary/5 to-transparent blur-3xl rounded-3xl" />

                <div className="relative rounded-xl lg:rounded-2xl overflow-hidden border border-border/40 shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)] bg-card">
                  <div className="bg-card border-b border-border/40 px-4 py-2.5 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-foreground/10" />
                      <div className="w-3 h-3 rounded-full bg-foreground/10" />
                      <div className="w-3 h-3 rounded-full bg-foreground/10" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="bg-muted rounded-md px-3 py-1 text-xs text-muted-foreground font-mono">app.credopass.com</div>
                    </div>
                  </div>
                  <ImageWithFallback src="/images/dash-1.png" alt="CredoPass Dashboard" className="w-full h-auto" />
                </div>

                {/* Floating stat cards */}
                <div className="hidden lg:flex absolute -left-8 top-1/3 bg-card/90 backdrop-blur-lg border border-border/60 rounded-xl p-4 shadow-2xl animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary/15 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight">+24%</p>
                      <p className="text-xs text-muted-foreground">Engagement</p>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:flex absolute -right-8 bottom-1/4 bg-card/90 backdrop-blur-lg border border-border/60 rounded-xl p-4 shadow-2xl animate-float" style={{ animationDelay: '2s' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary/15 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight">1,247</p>
                      <p className="text-xs text-muted-foreground">Checked In</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          LOGO CLOUD
          ============================================================ */}
      <section className="py-16 border-y border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground mb-8 tracking-wide uppercase">Trusted by leading organizations</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-40">
            <div className="text-2xl font-bold tracking-tight">ACME Church</div>
            <div className="text-2xl font-bold tracking-tight">BookClub+</div>
            <div className="text-2xl font-bold tracking-tight">Jazz Society</div>
            <div className="text-2xl font-bold tracking-tight">Community Hub</div>
            <div className="text-2xl font-bold tracking-tight">Event Co</div>
          </div>
        </div>
      </section>

      {/* ============================================================
          PROBLEM STATEMENT
          ============================================================ */}
      <Reveal>
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center flex flex-col gap-6">
              <Badge variant="outline" className="border-destructive/50 text-destructive w-fit mx-auto">The Problem</Badge>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-tight text-balance">
                Ticketing doesn't tell you who 
                <span className='relative inline-block ml-2'>
                  <span className="text-primary">actually attended</span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" aria-hidden="true">
                    <path d="M2 8.5C50 2.5 100 2 150 5.5C200 9 250 4.5 298 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/40" />
                  </svg>
                </span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                EventBrite and similar platforms manage payments beautifully. But they don't capture the data you actually need: real attendance, engagement patterns, and member behavior.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ============================================================
          HOW IT WORKS - 3 steps
          ============================================================ */}
      <section className="py-20 lg:py-28 border-y border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-2xl mx-auto text-center mb-16 flex flex-col gap-4">
              <Badge variant="outline" className="w-fit mx-auto">How It Works</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">Three steps. That's it.</h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
            {[
              { step: '01', icon: QrCode, title: 'Create an Event', desc: 'Set up your event in seconds. A unique QR code is generated automatically.' },
              { step: '02', icon: Smartphone, title: 'Members Scan', desc: 'Attendees scan the QR code on arrival. No app download required.' },
              { step: '03', icon: BarChart3, title: 'Get Insights', desc: 'Real-time analytics show who attended, when they arrived, and engagement trends.' },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 150}>
                <div className="relative flex flex-col items-center text-center gap-4">
                  <div className="text-7xl font-black tracking-tighter text-primary/10 select-none">{item.step}</div>
                  <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center -mt-8">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES GRID
          ============================================================ */}
      <section id="features" className="py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-2xl mb-16">
              <Badge variant="outline" className="mb-4">Platform</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
                Everything you need in one place
              </h2>
              <p className="text-lg text-muted-foreground">
                Built for organizations that meet regularly and need detailed attendance insights.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: QrCode, title: 'QR Code Check-In', desc: 'Instant check-ins with QR codes. No app downloads required -- just scan and go.' },
              { icon: LineChart, title: 'Real-Time Analytics', desc: 'Live attendance dashboards with trends, patterns, and actionable insights.' },
              { icon: Clock, title: 'Time Tracking', desc: 'Precise check-in and check-out times. Know exactly when people arrive and leave.' },
              { icon: UserCheck, title: 'Member Management', desc: 'Import your existing database. Custom fields and loyalty tiers included.' },
              { icon: Smartphone, title: 'Offline-First', desc: 'Check-ins work without internet. Auto-sync when connection returns.' },
              { icon: Globe, title: 'Integrations', desc: 'Works alongside EventBrite, Meetup, and your existing event tools.' },
              { icon: Award, title: 'Loyalty Program', desc: 'Reward frequent attendees with points, tiers, and recognition.' },
              { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 compliant. Data encryption at rest and in transit.' },
              { icon: Database, title: 'Export & API', desc: 'Full API access. Export data for reports, grants, and presentations.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <Card className="group p-6 bg-card border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_rgba(212,255,0,0.1)] h-full">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRODUCT SECTIONS
          ============================================================ */}
      <section id="product" className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-32">
          {/* Check-In Flow */}
          <Reveal>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="flex flex-col gap-6">
                <Badge variant="outline" className="w-fit">Check-In Flow</Badge>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">
                  Lightning-fast <span className="text-primary">QR check-ins</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Members scan a QR code and they're instantly checked in. No app downloads, no complicated setup. It just works.
                </p>
                <ul className="flex flex-col gap-3">
                  {['Unique QR code per event with auto-expiration', 'Manual check-in for members without phones', 'Real-time attendance counter on display'].map(t => (
                    <li key={t} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-transparent rounded-3xl blur-3xl" />
                <div className="relative rounded-xl lg:rounded-2xl overflow-hidden border border-border/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                  <ImageWithFallback src="/images/qr-page.png" alt="QR Code Check-in" className="w-full h-auto" />
                </div>
                <div className="absolute -bottom-6 -right-6 w-1/3 rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border border-border bg-background">
                  <ImageWithFallback src="/images/mobile-1.png" alt="Mobile Check-in" className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>
          </Reveal>

          {/* Analytics */}
          <Reveal>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-transparent rounded-3xl blur-3xl" />
                <div className="relative rounded-xl lg:rounded-2xl overflow-hidden border border-border/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                  <ImageWithFallback src="/images/dash-2.png" alt="Analytics Dashboard" className="w-full h-auto" />
                </div>
              </div>
              <div className="flex flex-col gap-6 order-1 lg:order-2">
                <Badge variant="outline" className="w-fit">Analytics</Badge>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">
                  Data that drives <span className="text-primary">decisions</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Comprehensive analytics dashboard shows attendance trends, engagement patterns, and member insights -- all in real time.
                </p>
                <ul className="flex flex-col gap-3">
                  {['Attendance rate trends over time', 'Member engagement and loyalty scores', 'Export reports for grants and board meetings'].map(t => (
                    <li key={t} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Members */}
          <Reveal>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="flex flex-col gap-6">
                <Badge variant="outline" className="w-fit">Member Portal</Badge>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">
                  <span className="text-primary">Manage members</span> effortlessly
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Import your existing member database via CSV. Add custom fields, track loyalty points, and view individual attendance history.
                </p>
                <ul className="flex flex-col gap-3">
                  {['One-click CSV import from any system', 'Custom fields for your organization', 'Full attendance history per member'].map(t => (
                    <li key={t} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-transparent rounded-3xl blur-3xl" />
                <div className="relative rounded-xl lg:rounded-2xl overflow-hidden border border-border/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                  <ImageWithFallback src="/images/members1.png" alt="Member Management" className="w-full h-auto" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          STATS
          ============================================================ */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {[
              { value: '10k+', label: 'Active Organizations' },
              { value: '5M+', label: 'Check-ins Processed' },
              { value: '99.9%', label: 'Uptime' },
              { value: '24/7', label: 'Support' },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="text-center flex flex-col gap-2">
                  <p className="text-5xl lg:text-6xl font-extrabold tracking-tighter text-primary" style={{ textShadow: '0 0 40px rgba(212,255,0,0.3)' }}>{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIALS
          ============================================================ */}
      <section id="customers" className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-2xl mb-16">
              <Badge variant="outline" className="mb-4">Testimonials</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
                Loved by organizations worldwide
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: 'CredoPass transformed how we track attendance. We finally have real engagement data to make informed decisions.', name: 'Sarah Richardson', role: 'Community Pastor', initials: 'SR' },
              { quote: 'Setup took less than 5 minutes. Our members love the QR code check-in. No more paper sheets!', name: 'Marcus Johnson', role: 'Book Club Organizer', initials: 'MJ' },
              { quote: 'The analytics are incredible. We use the reports for board meetings and grant applications.', name: 'Linda Parker', role: 'Center Director', initials: 'LP' },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <Card className="p-6 bg-card border-border/50 hover:border-border/80 transition-all duration-300 h-full flex flex-col">
                  {/* Quote mark */}
                  <svg className="w-8 h-8 text-primary/20 mb-4 shrink-0" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                  </svg>
                  <p className="text-muted-foreground mb-6 flex-1 leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="font-bold text-primary text-sm">{t.initials}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING
          ============================================================ */}
      {showPricing && (
        <section id="pricing" className="py-20 lg:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="max-w-2xl mx-auto text-center mb-16 flex flex-col gap-4">
                <Badge variant="outline" className="w-fit mx-auto">Pricing</Badge>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">Simple, transparent pricing</h2>
                <p className="text-lg text-muted-foreground">Start with a 30-day free trial. No credit card required.</p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Free */}
              <Reveal delay={0}>
                <Card className="p-8 bg-card border-border/50 h-full flex flex-col">
                  <div className="flex flex-col gap-6 flex-1">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Free</h3>
                      <p className="text-sm text-muted-foreground">For small groups</p>
                    </div>
                    <div>
                      <span className="text-5xl font-extrabold tracking-tight">$0</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <ul className="flex flex-col gap-3 flex-1">
                      {['Up to 100 members', 'Unlimited events', 'QR code check-in', 'Basic analytics'].map(f => (
                        <li key={f} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                          <span className="text-sm">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full" onClick={navigateToApp}>Get Started</Button>
                  </div>
                </Card>
              </Reveal>

              {/* Starter - Featured */}
              <Reveal delay={100}>
                <Card className="p-8 bg-card border-primary relative shadow-[0_16px_64px_-12px_rgba(212,255,0,0.15)] h-full flex flex-col">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground border-0 shadow-[0_0_16px_rgba(212,255,0,0.3)]">Most Popular</Badge>
                  </div>
                  <div className="flex flex-col gap-6 flex-1">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Starter</h3>
                      <p className="text-sm text-muted-foreground">For growing teams</p>
                    </div>
                    <div>
                      <span className="text-5xl font-extrabold tracking-tight">$5</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <ul className="flex flex-col gap-3 flex-1">
                      {['Up to 500 members', 'Everything in Free', 'Advanced analytics', 'Loyalty program', 'Custom branding'].map(f => (
                        <li key={f} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                          <span className="text-sm">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_16px_rgba(212,255,0,0.2)]">Get Started</Button>
                  </div>
                </Card>
              </Reveal>

              {/* Pro */}
              <Reveal delay={200}>
                <Card className="p-8 bg-card border-border/50 h-full flex flex-col">
                  <div className="flex flex-col gap-6 flex-1">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Pro</h3>
                      <p className="text-sm text-muted-foreground">For large organizations</p>
                    </div>
                    <div>
                      <span className="text-5xl font-extrabold tracking-tight">Custom</span>
                    </div>
                    <ul className="flex flex-col gap-3 flex-1">
                      {['Unlimited members', 'Everything in Starter', 'API access', 'Custom integrations', 'Dedicated support', 'SLA guarantee'].map(f => (
                        <li key={f} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                          <span className="text-sm">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full">Contact Sales</Button>
                  </div>
                </Card>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          FINAL CTA
          ============================================================ */}
      <section className="py-20 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        <Reveal>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
              <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center border border-primary/20">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-balance">
                Ready to track <span className="text-primary">real attendance</span>?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl">
                Join thousands of organizations using CredoPass to understand member engagement.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 h-12 shadow-[0_0_32px_rgba(212,255,0,0.25)] hover:shadow-[0_0_48px_rgba(212,255,0,0.4)] transition-all duration-300 hover:-translate-y-0.5" onClick={navigateToApp}>
                  Start For Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 hover:border-primary/40 transition-all duration-300">
                  Schedule Demo
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="border-t border-border/40 bg-muted/30 py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-lg tracking-tight">CredoPass</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                The modern attendance management system for organizations that meet regularly.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm">Product</h4>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm">Legal</h4>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; 2026 CredoPass. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
