const nodemailer = require('nodemailer');

let transporterPromise = null;

// Se SMTP_HOST estiver configurado (produção ou o próprio Gmail/SendGrid do usuário),
// usa esse servidor de verdade. Caso contrário, cria uma conta de teste no Ethereal
// (ethereal.email) automaticamente — um SMTP real que captura o e-mail em vez de
// entregá-lo, com uma URL de pré-visualização logada no console. Isso permite testar o
// fluxo completo de "esqueci minha senha" sem precisar de credenciais reais.
async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      }),
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((testAccount) => {
      console.warn(
        '[mailer] SMTP_HOST não configurado — usando conta de teste Ethereal. ' +
          'Os e-mails NÃO chegam a uma caixa real; a URL de pré-visualização aparece no console. ' +
          'Configure SMTP_HOST/SMTP_USER/SMTP_PASS em .env para enviar e-mails de verdade.',
      );
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    });
  }

  return transporterPromise;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
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

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[mailer] E-mail de reset (Ethereal, não é entrega real): ${previewUrl}`);
  }

  return info;
}

module.exports = { sendPasswordResetEmail };
