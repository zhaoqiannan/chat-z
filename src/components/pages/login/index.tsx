"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, Flex, TextInput, PasswordInput, Stack } from "@mantine/core";
import styles from './style.module.scss';
import BG from "./bg";
import { loginUser, registerUser } from "@/rest/user";

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    useEffect(() => {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            router.replace('/home');
        }
    }, [router]);

    const handleLogin = async () => {
        if (!username || !password) {
            setError('姓名和密码不能为空');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await loginUser({ username, password });
            router.replace('/home');
        } catch (err: any) {
            setError(err?.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!username || !password || !confirmPassword) {
            setError('所有字段均为必填项');
            return;
        }

        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await registerUser({ username, password });
            setSuccess('注册成功，请登录！');
            setPassword('');
            setConfirmPassword('');
            setIsLogin(true);
        } catch (err: any) {
            setError(err?.message || '注册失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box className={styles.container}>
            <BG />
            <Box className={styles.loginCard}>
                <Text className={styles.title}>{isLogin ? "欢迎登录" : "账号注册"}</Text>

                <Stack gap="16px" mb="24px" w="100%">
                    <TextInput
                        label={isLogin ? "姓名" : "用户名"}
                        placeholder={isLogin ? "请输入您的姓名" : "请设置您的用户名"}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.currentTarget.value);
                            setError('');
                            setSuccess('');
                        }}
                        error={error && !username ? `${isLogin ? "姓名" : "用户名"}不能为空` : null}
                        styles={{
                            label: { fontSize: '14px', color: '#475569', fontWeight: 600, marginBottom: '6px' },
                            input: { height: '44px', borderRadius: '6px', fontSize: '14px', border: '1px solid #cbd5e1' }
                        }}
                    />
                    <PasswordInput
                        label="密码"
                        placeholder={isLogin ? "请输入您的密码" : "请设置您的密码"}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.currentTarget.value);
                            setError('');
                            setSuccess('');
                        }}
                        error={error && !password ? "密码不能为空" : null}
                        styles={{
                            label: { fontSize: '14px', color: '#475569', fontWeight: 600, marginBottom: '6px' },
                            input: { height: '44px', borderRadius: '6px', fontSize: '14px', border: '1px solid #cbd5e1' },
                            innerInput: { height: '42px' }
                        }}
                    />
                    {!isLogin && (
                        <PasswordInput
                            label="确认密码"
                            placeholder="请再次输入您的密码"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.currentTarget.value);
                                setError('');
                                setSuccess('');
                            }}
                            error={error && !confirmPassword ? "确认密码不能为空" : (error && password !== confirmPassword ? "两次输入的密码不一致" : null)}
                            styles={{
                                label: { fontSize: '14px', color: '#475569', fontWeight: 600, marginBottom: '6px' },
                                input: { height: '44px', borderRadius: '6px', fontSize: '14px', border: '1px solid #cbd5e1' },
                                innerInput: { height: '42px' }
                            }}
                        />
                    )}
                </Stack>

                {error && (
                    <Text c="red" size="xs" mb="12px" fw={500} w="100%">
                        {error}
                    </Text>
                )}

                {success && (
                    <Text c="green" size="xs" mb="12px" fw={500} w="100%">
                        {success}
                    </Text>
                )}

                <button
                    className={styles.loginBtn}
                    onClick={isLogin ? handleLogin : handleRegister}
                    disabled={loading}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="3" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            {isLogin ? "正在登录..." : "正在注册..."}
                        </span>
                    ) : (
                        isLogin ? "登录" : "注册"
                    )}
                </button>

                <Flex justify="center" mt="16px">
                    <Text
                        size="sm"
                        c="#0087d3"
                        style={{ cursor: 'pointer', fontWeight: 500 }}
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setSuccess('');
                            setPassword('');
                            setConfirmPassword('');
                        }}
                    >
                        {isLogin ? "还没有账号？立即注册" : "已有账号？返回登录"}
                    </Text>
                </Flex>
            </Box>
        </Box>
    );
}