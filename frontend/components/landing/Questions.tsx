import { QUESTIONS } from "@/lib/landing-data";

export function Questions() {
  return (
    <section className="qa grid section" id="preguntas" aria-labelledby="preguntas-title">
      <h2 className="qa__heading" id="preguntas-title" data-reveal>
        Preguntas
      </h2>
      <p className="qa__intro" data-reveal style={{ ["--i" as string]: 1 }}>
        Lo que conviene saber antes de leer un resultado.
      </p>
      {QUESTIONS.map((item) => (
        <QuestionRow key={item.question} question={item.question} answer={item.answer} />
      ))}
    </section>
  );
}

function QuestionRow({ question, answer }: { question: string; answer: string }) {
  return (
    <>
      <h3 className="qa__q" data-reveal>
        {question}
      </h3>
      <p className="qa__a" data-reveal style={{ ["--i" as string]: 1 }}>
        {answer}
      </p>
    </>
  );
}
