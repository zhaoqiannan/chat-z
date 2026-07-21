import dynamic from 'next/dynamic';

const Login = dynamic(() => import('@/components/pages/login'));

export default Login;