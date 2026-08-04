import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CalendarDays, School, ShieldCheck, TimerReset, UserRound } from "lucide-react";
import PlayerPortal from "./components/PlayerPortal";

export default function HomePage() {
  return (
    <main className="site-shell champions-site">
      <section className="champions-hero">
        <div className="stadium-glow" />
        <div className="champions-hero-inner">
          <div className="champions-emblem-wrap">
            <div className="champions-emblem">
              <Image 
                src="/images/champions-badge.jpeg" 
                alt="أبطال دوري المدارس U13 2026" 
                fill 
                sizes="(max-width: 768px) 70vw, 320px" 
                priority 
              />
            </div>
          </div>
          <div className="champions-heading">
            <span className="hero-kicker">منصة تسجيل اللاعبين الرسمية</span>
            <h1>تسجيل لاعبي فريق<br/>عماد الدين زنكي المتوسطة</h1>
            <h2>أبطال دوري المدارس U13 <span>2026</span></h2>
          </div>
        </div>
      </section>

      <div className="team-facts-wrapper">
        <div className="team-facts">
          <article><CalendarDays/><div><span>الفئة</span><strong>U13</strong></div></article>
          <article><UserRound/><div><span>الجنس</span><strong>بنين</strong></div></article>
          <article><School/><div><span>المدرسة</span><strong>عماد الدين زنكي المتوسطة</strong></div></article>
          <article><BadgeCheck/><div><span>اللقب</span><strong>بطل المدن والمحافظات</strong></div></article>
        </div>
      </div>

      <div className="portal-container">
        <PlayerPortal />
      </div>

      <section className="trust-grid">
        <article>
          <ShieldCheck/>
          <h3>بياناتك آمنة</h3>
          <p>تُحفظ بياناتك ومرفقاتك في مساحة خاصة وفق ضوابط الوصول المعتمدة.</p>
        </article>
        <article>
          <BadgeCheck/>
          <h3>معتمد من المدرسة</h3>
          <p>تُراجع الطلبات من إدارة المدرسة قبل اعتمادها النهائي.</p>
        </article>
        <article>
          <TimerReset/>
          <h3>إجراء سريع</h3>
          <p>تحقق من هويتك وأكمل البيانات خلال دقائق بخطوات واضحة.</p>
        </article>
      </section>

      <footer>
        <p>جميع الحقوق محفوظة © 2026 مدرسة عماد الدين زنكي المتوسطة</p>
        <Link href="/admin" className="admin-footer-link">دخول الإدارة 🔑</Link>
      </footer>
    </main>
  );
}


