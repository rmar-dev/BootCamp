import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileAll, compileTrack } from './src/compiler.js';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const trackFilter = args.find((a) => !a.startsWith('--'));
  const curriculumDir = resolve(__dirname);

  console.log(`Compiling curriculum from ${curriculumDir}`);
  if (publish) console.log('Publishing enabled');
  if (trackFilter) console.log(`Filtering to track: ${trackFilter}`);

  let result;
  if (trackFilter) {
    const prisma = new PrismaClient();
    try {
      result = await compileTrack(prisma, curriculumDir, trackFilter, { publish });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    result = await compileAll(curriculumDir, { publish });
  }

  if (result.errors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\nCompilation complete:');
  console.log(`  Tracks:    ${result.tracksCompiled} compiled`);
  console.log(`  Lessons:   ${result.lessonsCompiled} compiled`);
  console.log(`  Exercises: ${result.exercisesCompiled} compiled`);
  console.log(`  Skipped:   ${result.skipped} (unchanged)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
