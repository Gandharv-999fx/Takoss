import { SimpleTakossOrchestrator } from '../src/orchestrator/simpleTakossOrchestrator';

async function main() {
  const orchestrator = new SimpleTakossOrchestrator(process.env.CLAUDE_API_KEY);

  const result = await orchestrator.generateApplication({
    projectName: 'my-blog',
    description: 'A modern blog platform',
    requirements: `
      Create a blog application with:
      - User authentication (register, login, logout)
      - Create, edit, delete blog posts
      - Rich text editor for posts
      - Comments on posts
      - User profiles
      - Search and filter posts
    `,
  });

  console.log('\n✅ Generation Complete!');
  console.log('\nPhases:', JSON.stringify(result.phases, null, 2));
  await orchestrator.close();
}

main().catch(console.error);
