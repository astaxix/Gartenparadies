import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const legalContent: Record<string, { title: string; content: React.ReactNode }> = {
  'agb': {
    title: 'Allgemeine Geschäftsbedingungen (AGB)',
    content: (
      <div className="space-y-4">
        <p>1. Geltungsbereich: Diese Allgemeinen Geschäftsbedingungen gelten für alle Bestellungen, die Verbraucher und Unternehmer über unseren Online-Shop tätigen.</p>
        <p>2. Vertragspartner, Vertragsschluss: Der Kaufvertrag kommt zustande mit Gartenparadies GmbH. Mit Einstellung der Produkte in den Online-Shop geben wir ein verbindliches Angebot zum Vertragsschluss über diese Artikel ab.</p>
        <p>3. Preise und Versandkosten: Die auf den Produktseiten genannten Preise enthalten die gesetzliche Mehrwertsteuer und sonstige Preisbestandteile. Zusätzlich zu den angegebenen Preisen berechnen wir für die Lieferung innerhalb Deutschlands Versandkosten.</p>
        <p>4. Zahlung: In unserem Shop stehen Ihnen grundsätzlich die folgenden Zahlungsarten zur Verfügung: Vorkasse, Kreditkarte, PayPal.</p>
        <p>5. Eigentumsvorbehalt: Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.</p>
      </div>
    )
  },
  'impressum': {
    title: 'Impressum',
    content: (
      <div className="space-y-4">
        <p><strong>Angaben gemäß § 5 TMG</strong></p>
        <p>Gartenparadies GmbH<br/>Musterstraße 123<br/>12345 Musterstadt</p>
        <p><strong>Vertreten durch:</strong><br/>Max Mustermann</p>
        <p><strong>Kontakt:</strong><br/>Telefon: +49 (0) 123 44 55 66<br/>E-Mail: kontakt@gartenparadies-muster.de</p>
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE123456789</p>
      </div>
    )
  },
  'datenschutz': {
    title: 'Datenschutzerklärung',
    content: (
      <div className="space-y-4">
        <p>Wir freuen uns über Ihr Interesse an unserem Online-Shop. Der Schutz Ihrer Privatsphäre ist für uns sehr wichtig. Nachstehend informieren wir Sie ausführlich über den Umgang mit Ihren Daten.</p>
        <p>Zugriffsdaten und Hosting: Sie können unsere Webseiten besuchen, ohne Angaben zu Ihrer Person zu machen. Bei jedem Aufruf einer Webseite speichert der Webserver lediglich automatisch ein sogenanntes Server-Logfile.</p>
        <p>Datenerhebung und -verwendung zur Vertragsabwicklung: Wir erheben personenbezogene Daten, wenn Sie uns diese im Rahmen Ihrer Bestellung oder bei einer Kontaktaufnahme freiwillig mitteilen.</p>
      </div>
    )
  },
  'widerruf': {
    title: 'Widerrufsbelehrung',
    content: (
      <div className="space-y-4">
        <p>Verbraucher haben ein vierzehntägiges Widerrufsrecht.</p>
        <p>Widerrufsrecht: Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
        <p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Ware in Besitz genommen haben bzw. hat.</p>
        <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>
      </div>
    )
  },
  'versand': {
    title: 'Versand & Zahlung',
    content: (
      <div className="space-y-4">
        <p>Die Versandkosten hängen von der Menge der bestellten Waren sowie der Versandart ab und werden Ihnen vor Abgabe Ihrer verbindlichen Bestellung deutlich mitgeteilt.</p>
        <p>Wir bieten kostenlosen Versand innerhalb Deutschlands ab einem Bestellwert von 49,00 € an.</p>
        <p>Folgende Zahlungsmöglichkeiten stehen Ihnen zur Verfügung:</p>
        <ul className="list-disc pl-5">
          <li>Vorkasse</li>
          <li>Kreditkarte</li>
          <li>PayPal</li>
        </ul>
      </div>
    )
  }
};

export default function LegalPage() {
  const { pageId } = useParams();
  const doc = legalContent[pageId || ''] || null;

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-800">404 - Seite nicht gefunden</h1>
        <Link to="/" className="mt-4 text-emerald-600 hover:underline">Zurück zur Startseite</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mb-8">
          <ArrowLeft className="w-4 h-4" /> Zurück zum Shop
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">{doc.title}</h1>
            <div className="prose prose-emerald max-w-none text-gray-600">
              {doc.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
