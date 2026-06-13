const MIN_VOCAB_SIZE = 100;
const MAX_VOCAB_SIZE = 10000;

function estimateVocabulary(answers) {
    if (!answers || answers.length === 0) {
        throw new Error('No answers provided');
    }

    const sortedAnswers = [...answers].sort((a, b) => a.rank - b.rank);

    const correctAnswers = sortedAnswers.filter(a => a.isCorrect);
    const incorrectAnswers = sortedAnswers.filter(a => !a.isCorrect);

    let estimatedVocab;

    if (correctAnswers.length === 0) {
        estimatedVocab = Math.min(...sortedAnswers.map(a => a.rank)) * 0.5;
    } else if (incorrectAnswers.length === 0) {
        estimatedVocab = Math.max(...sortedAnswers.map(a => a.rank)) * 1.2;
    } else {
        const maxCorrectRank = Math.max(...correctAnswers.map(a => a.rank));
        const minIncorrectRank = Math.min(...incorrectAnswers.map(a => a.rank));

        const correctRatio = correctAnswers.length / answers.length;
        estimatedVocab = maxCorrectRank * 0.7 + minIncorrectRank * 0.3;

        estimatedVocab = estimatedVocab * (0.8 + correctRatio * 0.4);
    }

    estimatedVocab = Math.round(
        Math.max(MIN_VOCAB_SIZE, Math.min(MAX_VOCAB_SIZE, estimatedVocab))
    );

    return {
        vocab_size: estimatedVocab,
        correct_count: correctAnswers.length,
        total_questions: answers.length,
        accuracy: Math.round((correctAnswers.length / answers.length) * 100)
    };
}

module.exports = {
    estimateVocabulary,
    MIN_VOCAB_SIZE,
    MAX_VOCAB_SIZE
};
