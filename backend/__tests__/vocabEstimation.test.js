const { estimateVocabulary, MIN_VOCAB_SIZE, MAX_VOCAB_SIZE } = require('../services/vocabEstimation');

describe('vocabEstimation', () => {
    describe('estimateVocabulary', () => {
        test('throws error when no answers provided', () => {
            expect(() => estimateVocabulary([])).toThrow('No answers provided');
            expect(() => estimateVocabulary(null)).toThrow('No answers provided');
            expect(() => estimateVocabulary(undefined)).toThrow('No answers provided');
        });

        test('all correct answers should estimate above highest rank', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: true },
                { wordId: 3, rank: 3000, isCorrect: true }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBeGreaterThan(3000);
            expect(result.vocab_size).toBe(3600);
            expect(result.correct_count).toBe(3);
            expect(result.total_questions).toBe(3);
            expect(result.accuracy).toBe(100);
        });

        test('all incorrect answers should estimate below lowest rank', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: false },
                { wordId: 2, rank: 2000, isCorrect: false },
                { wordId: 3, rank: 3000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBeLessThan(1000);
            expect(result.vocab_size).toBe(500);
            expect(result.correct_count).toBe(0);
            expect(result.total_questions).toBe(3);
            expect(result.accuracy).toBe(0);
        });

        test('mixed answers should estimate between max correct and min incorrect', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: true },
                { wordId: 3, rank: 3000, isCorrect: false },
                { wordId: 4, rank: 4000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBeGreaterThan(1000);
            expect(result.vocab_size).toBeLessThan(4000);
            expect(result.correct_count).toBe(2);
            expect(result.total_questions).toBe(4);
            expect(result.accuracy).toBe(50);
        });

        test('answers with unsorted ranks should produce correct result', () => {
            const answersUnsorted = [
                { wordId: 3, rank: 3000, isCorrect: false },
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 4, rank: 4000, isCorrect: false },
                { wordId: 2, rank: 2000, isCorrect: true }
            ];
            const answersSorted = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: true },
                { wordId: 3, rank: 3000, isCorrect: false },
                { wordId: 4, rank: 4000, isCorrect: false }
            ];
            const resultUnsorted = estimateVocabulary(answersUnsorted);
            const resultSorted = estimateVocabulary(answersSorted);
            expect(resultUnsorted.vocab_size).toBe(resultSorted.vocab_size);
        });

        test('very low rank should not go below MIN_VOCAB_SIZE', () => {
            const answers = [
                { wordId: 1, rank: 50, isCorrect: false },
                { wordId: 2, rank: 100, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBe(MIN_VOCAB_SIZE);
        });

        test('very high rank should not exceed MAX_VOCAB_SIZE', () => {
            const answers = [
                { wordId: 1, rank: 9000, isCorrect: true },
                { wordId: 2, rank: 10000, isCorrect: true }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBe(MAX_VOCAB_SIZE);
        });

        test('single correct answer', () => {
            const answers = [
                { wordId: 1, rank: 5000, isCorrect: true }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBe(6000);
            expect(result.correct_count).toBe(1);
            expect(result.total_questions).toBe(1);
            expect(result.accuracy).toBe(100);
        });

        test('single incorrect answer', () => {
            const answers = [
                { wordId: 1, rank: 5000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBe(2500);
            expect(result.correct_count).toBe(0);
            expect(result.total_questions).toBe(1);
            expect(result.accuracy).toBe(0);
        });

        test('boundary rank - exactly at MIN_VOCAB_SIZE', () => {
            const answers = [
                { wordId: 1, rank: 200, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBe(MIN_VOCAB_SIZE);
        });

        test('most answers correct with few wrong at higher ranks', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: true },
                { wordId: 3, rank: 3000, isCorrect: true },
                { wordId: 4, rank: 4000, isCorrect: true },
                { wordId: 5, rank: 5000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBeGreaterThan(3000);
            expect(result.vocab_size).toBeLessThan(5000);
            expect(result.accuracy).toBe(80);
        });

        test('most answers wrong with few correct at lower ranks', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: false },
                { wordId: 3, rank: 3000, isCorrect: false },
                { wordId: 4, rank: 4000, isCorrect: false },
                { wordId: 5, rank: 5000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result.vocab_size).toBeGreaterThan(500);
            expect(result.vocab_size).toBeLessThan(2000);
            expect(result.accuracy).toBe(20);
        });

        test('vocab_size should be an integer', () => {
            const answers = [
                { wordId: 1, rank: 1234, isCorrect: true },
                { wordId: 2, rank: 5678, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(Number.isInteger(result.vocab_size)).toBe(true);
        });

        test('returns correct stats structure', () => {
            const answers = [
                { wordId: 1, rank: 1000, isCorrect: true },
                { wordId: 2, rank: 2000, isCorrect: false }
            ];
            const result = estimateVocabulary(answers);
            expect(result).toHaveProperty('vocab_size');
            expect(result).toHaveProperty('correct_count');
            expect(result).toHaveProperty('total_questions');
            expect(result).toHaveProperty('accuracy');
            expect(typeof result.vocab_size).toBe('number');
            expect(typeof result.correct_count).toBe('number');
            expect(typeof result.total_questions).toBe('number');
            expect(typeof result.accuracy).toBe('number');
        });
    });

    describe('constants', () => {
        test('MIN_VOCAB_SIZE is 100', () => {
            expect(MIN_VOCAB_SIZE).toBe(100);
        });

        test('MAX_VOCAB_SIZE is 10000', () => {
            expect(MAX_VOCAB_SIZE).toBe(10000);
        });
    });
});
