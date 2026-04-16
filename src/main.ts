import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false, trickleSpeed: 200 });

router.beforeEach((to, from, next) => {
	NProgress.start();
	next();
});
router.afterEach(() => {
	NProgress.done();
});

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
	console.error('[Vue Error]', info, err);
	NProgress.done();
};

window.addEventListener('unhandledrejection', (event) => {
	console.error('[Unhandled Promise]', event.reason);
	NProgress.done();
});

app.use(router).mount('#app');

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js');
	});
}
