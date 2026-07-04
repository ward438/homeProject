/**
 * Base div props shared by all auth form wrapper components
 * (LoginForm, SignUpForm, ForgotPasswordForm, UpdatePasswordForm).
 * Extending this gives each form consistent className/style/ref forwarding.
 */
export type AuthFormContainerProps = React.ComponentPropsWithoutRef<'div'>
