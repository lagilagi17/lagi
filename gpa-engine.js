const GPA = (() => {
  const scales = Object.freeze({
    '4.3': Object.freeze({
      max: 4.3,
      grades: Object.freeze({
        'A+': 4.3, A0: 4, 'A-': 3.7,
        'B+': 3.3, B0: 3, 'B-': 2.7,
        'C+': 2.3, C0: 2, 'C-': 1.7,
        'D+': 1.3, D0: 1, 'D-': 0.7,
        F: 0, P: null, NP: null,
      }),
    }),
    '4.5': Object.freeze({
      max: 4.5,
      grades: Object.freeze({
        'A+': 4.5, A0: 4, 'B+': 3.5, B0: 3,
        'C+': 2.5, C0: 2, 'D+': 1.5, D0: 1,
        F: 0, P: null, NP: null,
      }),
    }),
  });

  function calculate(rows, scaleKey) {
    const key = String(scaleKey);
    const scale = Object.prototype.hasOwnProperty.call(scales, key) ? scales[key] : null;
    const errors = [];
    let creditHalves = 0;
    let earnedHalves = 0;
    let qualityTwentieths = 0;
    let includedCount = 0;
    let completeCount = 0;
    let activeCount = 0;

    if (!scale) {
      errors.push({ id: null, field: 'scale', message: '지원하는 만점 기준을 선택해 주세요.' });
    }
    if (!Array.isArray(rows)) {
      errors.push({ id: null, field: 'rows', message: '과목 목록을 확인해 주세요.' });
      rows = [];
    }

    rows.forEach((row, index) => {
      const item = row && typeof row === 'object' ? row : {};
      const id = item.id ?? index;
      const name = String(item.name ?? '').trim();
      const rawCredits = item.credits;
      const creditsText = String(rawCredits ?? '').trim();
      const grade = String(item.grade ?? '').trim();
      if (!name && !creditsText && !grade) return;
      activeCount++;

      let credits;
      let validCredits = true;
      if (!creditsText) {
        errors.push({ id, field: 'credits', message: '학점을 입력해 주세요.' });
        validCredits = false;
      } else if ((typeof rawCredits !== 'string' && typeof rawCredits !== 'number') ||
        !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(creditsText)) {
        errors.push({ id, field: 'credits', message: '학점은 숫자로 입력해 주세요.' });
        validCredits = false;
      } else {
        credits = Number(creditsText);
        if (!Number.isFinite(credits) || credits <= 0 || credits > 100) {
          errors.push({ id, field: 'credits', message: '학점은 0보다 크고 100 이하여야 해요.' });
          validCredits = false;
        } else if (!Number.isInteger(credits * 2)) {
          errors.push({ id, field: 'credits', message: '학점은 0.5 단위로 입력해 주세요.' });
          validCredits = false;
        }
      }

      const validGrade = !!scale && Object.prototype.hasOwnProperty.call(scale.grades, grade);
      if (!grade) {
        errors.push({ id, field: 'grade', message: '성적을 선택해 주세요.' });
      } else if (scale && !validGrade) {
        errors.push({ id, field: 'grade', message: '선택한 만점 기준에 맞는 성적을 선택해 주세요.' });
      }
      if (!validCredits || !validGrade) return;

      completeCount++;
      const halves = credits * 2;
      if (grade !== 'F' && grade !== 'NP') earnedHalves += halves;
      if (grade === 'P' || grade === 'NP') return;
      includedCount++;
      creditHalves += halves;
      qualityTwentieths += halves * Math.round(scale.grades[grade] * 10);
    });

    const hasIncomplete = errors.length > 0;
    return {
      gpa: !hasIncomplete && creditHalves > 0 ? qualityTwentieths / (creditHalves * 10) : null,
      qualityPoints: qualityTwentieths / 20,
      gpaCredits: creditHalves / 2,
      qualityTwentieths,
      creditHalves,
      earnedCredits: earnedHalves / 2,
      includedCount,
      completeCount,
      activeCount,
      errors,
      hasIncomplete,
    };
  }

  function format(result) {
    if (!result || result.gpa === null || result.hasIncomplete) return null;
    const { qualityTwentieths, creditHalves } = result;
    if (!Number.isSafeInteger(qualityTwentieths) || qualityTwentieths < 0 ||
      !Number.isSafeInteger(creditHalves) || creditHalves <= 0) return null;

    // GPA = qualityTwentieths / (10 * creditHalves). Round to hundredths
    // using only integers so decimal ties such as 4.225 round up to 4.23.
    const hundredths = Math.floor((20 * qualityTwentieths + creditHalves) / (2 * creditHalves));
    return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
  }

  return Object.freeze({ scales, calculate, format });
})();
