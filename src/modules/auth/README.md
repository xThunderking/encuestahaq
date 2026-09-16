# Auth

El acceso administrativo requiere iniciar sesión con Google y verificar un
código de seis dígitos enviado al correo verificado de esa misma cuenta. El
reto queda en una cookie `HttpOnly`, vence a los diez minutos, solo puede
usarse una vez y permite cinco intentos.
