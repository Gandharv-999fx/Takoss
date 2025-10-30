import { PrismaClient } from '@prisma/client';
import { promptTemplates } from '../src/templates/promptTemplates';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with default prompt templates...');

  let seededCount = 0;
  let skippedCount = 0;

  for (const template of promptTemplates) {
    try {
      // Check if template already exists by name
      const existing = await prisma.promptTemplate.findFirst({
        where: { name: template.name },
      });

      if (existing) {
        console.log(`⏭️  Skipping "${template.name}" (already exists)`);
        skippedCount++;
        continue;
      }

      // Map category to enum
      const category = template.category.toUpperCase() as any;
      const modelType = template.modelType?.toUpperCase() as any;

      // Create template
      await prisma.promptTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          template: template.template,
          variables: template.variables,
          category: category,
          modelType: modelType || null,
          tags: [template.category, modelType?.toLowerCase() || 'any'],
          examples: template.examples
            ? {
                create: template.examples.map((ex) => ({
                  input: ex.input,
                  output: ex.output,
                })),
              }
            : undefined,
        },
      });

      console.log(`✅ Seeded "${template.name}"`);
      seededCount++;
    } catch (error) {
      console.error(`❌ Failed to seed "${template.name}":`, error);
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   Seeded: ${seededCount} templates`);
  console.log(`   Skipped: ${skippedCount} templates`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
