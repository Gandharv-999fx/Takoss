import { SimpleTakossOrchestrator } from './src/orchestrator/simpleTakossOrchestrator';
import { ProjectWriter } from './src/output/projectWriter';
import { GeminiModel } from './src/types/modelConfig';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🧪 Testing Component Generation Fix...\n');

  const orchestrator = new SimpleTakossOrchestrator();

  const result = await orchestrator.generateApplication({
    projectName: 'test-name-form',
    description: 'Simple name entry form',
    requirements: 'Create a form that lets users enter their name',
    modelStrategy: 'custom',
    customModels: {
      requirementsAnalysis: GeminiModel.GEMINI_2_5_FLASH,
      schemaGeneration: GeminiModel.GEMINI_2_5_FLASH,
      componentGeneration: GeminiModel.GEMINI_2_5_FLASH,
      apiGeneration: GeminiModel.GEMINI_2_5_FLASH,
      deploymentGeneration: GeminiModel.GEMINI_2_5_FLASH,
    },
  });

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('Success:', result.success);
  console.log('Frontend Components Generated:', result.phases?.frontend?.componentCount || 0);

  if (result.phases?.frontend?.components) {
    console.log('\n🎨 Components:');
    result.phases.frontend.components.forEach((comp: any) => {
      console.log(`  - ${comp.name} (${comp.fileName})`);
      console.log(`    Code Length: ${comp.code?.length || 0} characters`);
    });
  }

  // Test ProjectWriter conversion
  if (result.success) {
    console.log('\n📝 Testing ProjectWriter...');
    const writer = new ProjectWriter();
    const project = writer.convertGenerationToProject(
      result.projectId,
      'test-name-form',
      'Simple name entry form',
      'Create a form that lets users enter their name',
      result
    );

    console.log(`Total Files Generated: ${project.files.length}`);

    const frontendFiles = project.files.filter(f => f.path.startsWith('frontend/'));
    console.log(`Frontend Files: ${frontendFiles.length}`);

    frontendFiles.forEach(file => {
      console.log(`  - ${file.path}`);
    });

    // Write project to disk
    console.log('\n💾 Writing project to disk...');
    const projectPath = await writer.writeProject(project);
    console.log(`✅ Project written to: ${projectPath}`);
  }

  await orchestrator.close();

  console.log('\n' + (result.success ? '✅ Test PASSED!' : '❌ Test FAILED!'));
}

main().catch(console.error);
