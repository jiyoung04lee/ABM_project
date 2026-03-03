"use client";

import styles from "./NetworkHero.module.css";

export type NetworkTab = "student" | "graduate" | "qa";

export default function NetworkHero({
  tab,
  onChangeTab,
}: {
  tab: NetworkTab;
  onChangeTab: (t: NetworkTab) => void;
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        {/* 상단 pill */}
        <div className={styles.pill}>✨ 선배들의 생생한 경험을 공유합니다</div>

        {/* 타이틀/서브 */}
        <h1 className={styles.title}>네트워크</h1>
        <p className={styles.subtitle}>실전 경험과 노하우를 한곳에서 찾아보세요</p>

        {/* 가운데 탭 컨테이너 */}
        <div className={styles.tabWrap}>
          <div className={styles.tabContainer}>
            <div className={styles.tabRow}>
              <button
                className={`${styles.tabBtn} ${tab === "student" ? styles.tabBtnActive : ""}`}
                onClick={() => onChangeTab("student")}
              >
                재학생
              </button>
              <button
                className={`${styles.tabBtn} ${tab === "graduate" ? styles.tabBtnActive : ""}`}
                onClick={() => onChangeTab("graduate")}
              >
                졸업생
              </button>
              <button
                className={`${styles.tabBtn} ${tab === "qa" ? styles.tabBtnActive : ""}`}
                onClick={() => onChangeTab("qa")}
              >
                Q&amp;A
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}