import { useState } from 'react';

import {
  figureSequenceAnswerLabel,
  figureSequenceCorrectLabel,
} from '@/components/questions/FigureSequenceView';
import {
  latinSquaresAnswerLabel,
  latinSquaresCorrectLabel,
} from '@/components/questions/LatinSquaresView';
import {
  mathEquationsAnswerLabel,
  mathEquationsCorrectLabel,
} from '@/components/questions/MathEquationsView';
import { Explanation } from '@/components/Explanation';
import { QuestionBody } from '@/components/QuestionPanel';
import { Badge, Button, Card, cx } from '@/components/ui';
import type {
  Answer,
  FigureSequenceAnswer,
  LatinSquaresAnswer,
  MathEquationsAnswer,
  Question,
  QuestionOutcome,
  QuestionScore,
} from '@/types';

/**
 * Question-by-question review: the test taker's answer, the correct answer and
 * the explanation, for every task of a section.
 */

const OUTCOME_TONE: Record<QuestionOutcome, 'success' | 'danger' | 'warning' | 'neutral'> = {
  correct: 'success',
  incorrect: 'danger',
  partial: 'warning',
  unanswered: 'neutral',
};

const OUTCOME_LABEL: Record<QuestionOutcome, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  partial: 'Partially correct',
  unanswered: 'Not answered',
};

export function answerLabel(question: Question, answer: Answer | undefined): string {
  switch (question.type) {
    case 'figure-sequence':
      return figureSequenceAnswerLabel(answer as FigureSequenceAnswer | undefined);
    case 'math-equations':
      return mathEquationsAnswerLabel(question, answer as MathEquationsAnswer | undefined);
    case 'latin-squares':
      return latinSquaresAnswerLabel(answer as LatinSquaresAnswer | undefined);
  }
}

export function correctAnswerLabel(question: Question): string {
  switch (question.type) {
    case 'figure-sequence':
      return figureSequenceCorrectLabel(question);
    case 'math-equations':
      return mathEquationsCorrectLabel(question);
    case 'latin-squares':
      return latinSquaresCorrectLabel(question);
  }
}

export function ReviewItem({
  question,
  index,
  answer,
  score,
  defaultOpen = false,
}: {
  question: Question;
  index: number;
  answer: Answer | undefined;
  score: QuestionScore;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const outcome = score.outcome;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink-900">Q{index + 1}</span>
          <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>
          <Badge tone="neutral">{question.difficulty}</Badge>
          <span className="text-xs font-medium tabular-nums text-ink-500">
            {score.points} / {score.maxPoints} pt
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide details' : 'Show details'}
        </Button>
      </div>

      <div className="grid gap-2 border-t border-ink-100 bg-ink-50/60 px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your answer</p>
          <p
            className={cx(
              'mt-0.5 font-medium',
              outcome === 'correct'
                ? 'text-emerald-700'
                : outcome === 'unanswered'
                  ? 'text-ink-500'
                  : 'text-red-700',
            )}
          >
            {answerLabel(question, answer)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Correct answer
          </p>
          <p className="mt-0.5 font-medium text-emerald-700">{correctAnswerLabel(question)}</p>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-ink-100 px-4 py-4">
          <QuestionBody
            question={question}
            answer={answer}
            onChange={() => undefined}
            disabled
            reveal
          />
          <Explanation lines={question.explanation} />
        </div>
      ) : null}
    </Card>
  );
}

export function ReviewList({
  questions,
  answers,
  scores,
}: {
  questions: Question[];
  answers: Record<string, Answer>;
  scores: QuestionScore[];
}) {
  const [filter, setFilter] = useState<'all' | QuestionOutcome>('all');
  const scoreById = new Map(scores.map((score) => [score.questionId, score]));

  const visible = questions.filter((question) => {
    if (filter === 'all') return true;
    return scoreById.get(question.id)?.outcome === filter;
  });

  const countOf = (outcome: QuestionOutcome) =>
    scores.filter((score) => score.outcome === outcome).length;

  const filters: { key: 'all' | QuestionOutcome; label: string }[] = [
    { key: 'all', label: `All (${questions.length})` },
    { key: 'correct', label: `Correct (${countOf('correct')})` },
    { key: 'partial', label: `Partial (${countOf('partial')})` },
    { key: 'incorrect', label: `Incorrect (${countOf('incorrect')})` },
    { key: 'unanswered', label: `Unanswered (${countOf('unanswered')})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? 'secondary' : 'outline'}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center text-sm text-ink-500">
          No questions in this category.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((question) => {
            const index = questions.findIndex((candidate) => candidate.id === question.id);
            const score = scoreById.get(question.id);
            if (!score) return null;
            return (
              <ReviewItem
                key={question.id}
                question={question}
                index={index}
                answer={answers[question.id]}
                score={score}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
