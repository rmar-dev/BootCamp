import { buildHarness } from '../../src/execution/harness';

describe('buildHarness', () => {
  const studentCode = 'func greet() -> String { return "hello" }';
  const testCode = 'assert(greet() == "hello")';

  it('Swift: includes bootcampAssert helper before student code', () => {
    const result = buildHarness('swift', studentCode, testCode);
    expect(result).toContain('func bootcampAssert(');
    expect(result).toContain('func bootcampAssertEqual');
    const helperIdx = result.indexOf('bootcampAssert');
    const studentIdx = result.indexOf(studentCode);
    expect(helperIdx).toBeLessThan(studentIdx);
  });

  it('Swift: student code appears before the marker', () => {
    const result = buildHarness('swift', studentCode, testCode);
    const markerIdx = result.indexOf('// --- tests below ---');
    const studentIdx = result.indexOf(studentCode);
    expect(studentIdx).toBeGreaterThanOrEqual(0);
    expect(studentIdx).toBeLessThan(markerIdx);
  });

  it('Swift: testCode appears after the marker', () => {
    const result = buildHarness('swift', studentCode, testCode);
    const testIdx = result.indexOf(testCode);
    const markerIdx = result.indexOf('// --- tests below ---');
    expect(testIdx).toBeGreaterThan(markerIdx);
  });

  it('Kotlin: student code appears before fun main()', () => {
    const ktStudentCode = 'fun greet(): String { return "hello" }';
    const ktTestCode = '  check(greet() == "hello")';
    const result = buildHarness('kotlin', ktStudentCode, ktTestCode);
    const studentIdx = result.indexOf(ktStudentCode);
    const mainIdx = result.indexOf('fun main()');
    expect(studentIdx).toBeGreaterThanOrEqual(0);
    expect(studentIdx).toBeLessThan(mainIdx);
  });

  it('Kotlin: testCode is wrapped in fun main() block', () => {
    const ktStudentCode = 'fun greet(): String { return "hello" }';
    const ktTestCode = '  check(greet() == "hello")';
    const result = buildHarness('kotlin', ktStudentCode, ktTestCode);
    expect(result).toContain('fun main() {\n');
    const mainIdx = result.indexOf('fun main() {');
    const testIdx = result.indexOf(ktTestCode);
    const closingBrace = result.lastIndexOf('}');
    expect(testIdx).toBeGreaterThan(mainIdx);
    expect(testIdx).toBeLessThan(closingBrace);
  });
});
