const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

// Sem SMTP_HOST configurado, o sistema roda em modo SIMULAÇÃO: nenhum e-mail é
// enviado de verdade — o conteúdo (incluindo o link de redefinição) é só impresso no
// console do backend. Isso permite demonstrar e testar o fluxo completo de "esqueci
// minha senha" sem precisar de credenciais reais nem de acesso à internet. Para
// enviar e-mails de verdade, preencha SMTP_HOST/SMTP_USER/SMTP_PASS no .env.
async function sendPasswordResetEmail(to, resetUrl) {
  if (!process.env.SMTP_HOST) {
    console.log('\n[mailer] MODO SIMULAÇÃO — nenhum e-mail real foi enviado (SMTP_HOST não configurado).');
    console.log(`[mailer] Destinatário: ${to}`);
    console.log(`[mailer] Link de redefinição de senha: ${resetUrl}\n`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'ThermoSense <no-reply@thermosense.local>',
    to,
    subject: 'Redefinição de senha — ThermoSense',
    text: `Recebemos uma solicitação para redefinir sua senha. Acesse o link abaixo (válido por 1 hora):\n\n${resetUrl}\n\nSe você não pediu isso, ignore este e-mail — sua senha continua a mesma.`,
    html: `
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p><a href="${resetUrl}">Clique aqui para definir uma nova senha</a> (o link expira em 1 hora).</p>
      <p>Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
