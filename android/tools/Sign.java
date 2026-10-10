import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

/**
 * امضای APK (نسخهٔ ۱ و ۲) با کتابخانهٔ apksig گوگل — بدون نیاز به apksigner.
 *
 * استفاده:
 *   java -cp apksig.jar;. Sign <in.apk> <out.apk> <keystore> <storepass> <alias>
 */
public class Sign {

    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("usage: Sign <in.apk> <out.apk> <keystore> <pass> <alias>");
            System.exit(2);
        }
        File in = new File(args[0]);
        File out = new File(args[1]);
        File ksFile = new File(args[2]);
        char[] pass = args[3].toCharArray();
        String alias = args[4];

        KeyStore ks = KeyStore.getInstance("PKCS12");
        FileInputStream fi = new FileInputStream(ksFile);
        try {
            ks.load(fi, pass);
        } finally {
            fi.close();
        }

        PrivateKey key = (PrivateKey) ks.getKey(alias, pass);
        if (key == null) throw new IllegalStateException("کلید با این نام در کلیدفروشگاه نیست: " + alias);

        List<X509Certificate> chain = new ArrayList<X509Certificate>();
        java.security.cert.Certificate[] cs = ks.getCertificateChain(alias);
        if (cs == null || cs.length == 0) throw new IllegalStateException("زنجیرهٔ گواهی پیدا نشد.");
        for (java.security.cert.Certificate c : cs) chain.add((X509Certificate) c);

        ApkSigner.SignerConfig signer =
                new ApkSigner.SignerConfig.Builder(alias, key, chain).build();
        List<ApkSigner.SignerConfig> signers = new ArrayList<ApkSigner.SignerConfig>();
        signers.add(signer);

        ApkSigner apkSigner = new ApkSigner.Builder(signers)
                .setInputApk(in)
                .setOutputApk(out)
                .setV1SigningEnabled(true)
                .setV2SigningEnabled(true)
                .setMinSdkVersion(21)
                .build();
        apkSigner.sign();

        System.out.println("SIGNED " + out.getAbsolutePath() + " (" + (out.length() / 1024) + " KB)");
    }
}
