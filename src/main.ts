import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';
const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
	console.error('[Vue Error]', info, err);
};

window.addEventListener('unhandledrejection', (event) => {
	console.error('[Unhandled Promise]', event.reason);
});

app.use(router).mount('#app');

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js');
	});
}
