import styles from "./modules.module.css";

function SkeletonHeader({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className={styles.skeletonHeader}>
      <div className={styles.skeletonHeadText}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonBlock} ${styles.skeletonSubtitle}`} />
      </div>
      {withActions && (
        <div className={styles.skeletonActions}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonButton}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonButton}`} />
        </div>
      )}
    </div>
  );
}

function SkeletonTableCard({ rows = 5 }: { rows?: number }) {
  return (
    <section className={styles.panelCard}>
      <div className={styles.skeletonPanelTop}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} style={{ width: "32%" }} />
        <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
      </div>
      <div className={styles.skeletonTable}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.skeletonTableRow}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className={styles.viewRoot} role="status" aria-busy="true" aria-label="Cargando resumen del laboratorio">
      <span className="sr-only">Cargando resumen del laboratorio…</span>
      <SkeletonHeader withActions />
      <div className={`${styles.skeletonBlock} ${styles.skeletonProvenance}`} />
      <div className={styles.skeletonKpiGrid3}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeletonKpiCell}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonKpiNum}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <SkeletonTableCard rows={6} />
      </div>
    </div>
  );
}

export function TableWorkspaceSkeleton({
  title,
  rows = 5,
  showToolbar = false,
}: {
  title: string;
  rows?: number;
  showToolbar?: boolean;
}) {
  return (
    <div className={styles.viewRoot} role="status" aria-busy="true" aria-label={`Cargando ${title}`}>
      <span className="sr-only">Cargando {title}…</span>
      <SkeletonHeader withActions={showToolbar} />
      {showToolbar && (
        <section className={styles.panelCard} style={{ marginTop: 16 }}>
          <div className={styles.skeletonToolbar}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonControl}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonControl}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonButton}`} />
          </div>
        </section>
      )}
      <div style={{ marginTop: 20 }}>
        <SkeletonTableCard rows={rows} />
      </div>
    </div>
  );
}

export function PortfolioDetailSkeleton() {
  return (
    <div className={styles.viewRoot} role="status" aria-busy="true" aria-label="Cargando detalle de cartera">
      <span className="sr-only">Cargando detalle de cartera…</span>
      <SkeletonHeader withActions />
      <div className={styles.skeletonKpiGrid3} style={{ marginTop: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeletonKpiCell}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonKpiNum}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
          </div>
        ))}
      </div>
      <section className={styles.panelCard} style={{ marginTop: 24 }}>
        <div className={styles.skeletonPanelTop}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} style={{ width: "36%" }} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
        </div>
        <div className={`${styles.skeletonBlock} ${styles.skeletonChartTall}`} />
      </section>
      <div style={{ marginTop: 24 }}>
        <SkeletonTableCard rows={4} />
      </div>
    </div>
  );
}

export function AnalyticalModuleSkeleton({
  title,
  showSplit = true,
}: {
  title: string;
  showSplit?: boolean;
}) {
  return (
    <div className={styles.viewRoot} role="status" aria-busy="true" aria-label={`Cargando ${title}`}>
      <span className="sr-only">Cargando {title}…</span>
      <SkeletonHeader />
      <section className={styles.panelCard} style={{ marginTop: 16 }}>
        <div className={styles.skeletonToolbar}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonControl}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonControl}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonControl}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonButton}`} />
        </div>
      </section>
      <div className={`${styles.skeletonBlock} ${styles.skeletonProvenance}`} />
      <div className={styles.skeletonKpiGrid4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeletonKpiCell}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonKpiNum}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
          </div>
        ))}
      </div>
      {showSplit ? (
        <div className={styles.splitGrid}>
          <section className={styles.panelCard}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} style={{ width: "44%" }} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonChartTall}`} />
          </section>
          <SkeletonTableCard rows={4} />
        </div>
      ) : (
        <section className={styles.panelCard} style={{ marginTop: 20 }}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} style={{ width: "38%" }} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonChartTall}`} />
        </section>
      )}
    </div>
  );
}
