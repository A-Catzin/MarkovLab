import { REQUEST_STAGES } from "@/lib/landing-data";

export function Pipeline() {
  const total = REQUEST_STAGES.reduce((sum, stage) => sum + stage.ms, 0);
  return (
    <section className="section pipeline" id="como-funciona" aria-labelledby="pipeline-title">
      <h2 className="pipeline__title" id="pipeline-title" data-reveal>
        Tres milisegundos
      </h2>
      <div className="pipeline__bar" data-ui>
        {REQUEST_STAGES.map((stage, i) => (
          <div className="stage" key={stage.duration} style={{ flexGrow: stage.ms }} data-reveal>
            <div className="stage__block" style={{ ["--i" as string]: i }}>
              {stage.duration}
            </div>
            <p className="stage__clause">{stage.clause}</p>
          </div>
        ))}
      </div>
      <p className="pipeline__finding" data-reveal>
        Una solicitud de 10,000 escenarios tarda {total.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ms en
        total. Simular es rápido; lo que más cuesta es ordenar los resultados para calcular percentiles, VaR y CVaR.
        Mediana de 30 ejecuciones en el motor Julia.
      </p>
    </section>
  );
}
