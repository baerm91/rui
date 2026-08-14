import gsap from 'gsap';
import { ctx } from './context.js';

export function playInitialIntro() {
  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    onComplete: () => {
      window.appState.update({
        introPhase: 'done',
        hasIntroPlayed: true
      });
    }
  });

  tl.to({}, { duration: 1.0 });
  tl.add(() => window.appState.update({ introPhase: 'model' }));
  tl.to(ctx.introModelOpacity, { value: 1, duration: 1.1 });
  tl.add(() => window.appState.update({ introPhase: 'text' }), '-=0.15');
  tl.to({}, { duration: 0.9 });
}
