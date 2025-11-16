import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Use only the progress bar, hide the NProgress spinner that appears by default
NProgress.configure({ showSpinner: false, trickleSpeed: 200 });

router.beforeEach((to, from, next) => {
	NProgress.start();
	next();
});
router.afterEach(() => {
	NProgress.done();
});

createApp(App).use(router).mount('#app');
