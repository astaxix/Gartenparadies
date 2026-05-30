import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Droplets,
  Map,
  Sun,
  CheckCircle,
  Download,
  ShoppingCart,
  Minus,
  Plus,
  AlertCircle,
  ShoppingBag,
  ShieldCheck,
  User,
  FileText,
  X,
  Check,
  ArrowRight,
  Trash2,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PlannerCanvas, { PlannerData } from "./PlannerCanvas";
import { Product, CartItem } from "../types";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { db, auth, loginWithGoogle } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

interface PlannerProps {
  products?: Product[];
  onAddToCart?: (
    product: Product,
    selectedVariations?: Record<string, string>,
    addedQuantity?: number,
    customProps?: any,
  ) => void;
  onOpenCart?: () => void;
  cartItems?: CartItem[];
  currentUser?: any;
  setCurrentUser?: (user: any) => void;
}

const formatLastEdited = (dateStr: string) => {
  if (!dateStr) return "";
  if (dateStr.includes(".") && dateStr.includes(",")) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function Planner({
  products = [],
  onAddToCart,
  onOpenCart,
  cartItems = [],
  currentUser,
  setCurrentUser,
}: PlannerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState<"menu" | "canvas" | "bom">(
    "canvas",
  );
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSelbstbau, setIsSelbstbau] = useState(false);

  const [savedCanvasState, setSavedCanvasState] = useState<any | null>(null);

  // Saved plans states
  const [isSavedPlansModalOpen, setIsSavedPlansModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savePlanName, setSavePlanName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [onlinePlans, setOnlinePlans] = useState<any[]>([]);

  // Auth inside Planner
  const [isPlannerAuthModalOpen, setIsPlannerAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordRepeat, setRegPasswordRepeat] = useState("");
  const [regName, setRegName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Restore calculated planner view if requested from shopping cart or url params
  const queryParams = new URLSearchParams(location.search);
  const viewPackageRequested = queryParams.get("view_package") === "true";

  useEffect(() => {
    if (!currentUser || !isSavedPlansModalOpen) return;

    async function fetchPlans() {
      try {
        const q = query(
          collection(db, "plans"),
          where("userId", "==", currentUser.id),
        );
        const s = await getDocs(q);
        const loaded = s.docs.map((doc) => doc.data());
        setOnlinePlans(loaded);
      } catch (err) {
        console.error("Failed fetching plans from Firestore:", err);
      }
    }
    fetchPlans();
  }, [currentUser, isSavedPlansModalOpen]);

  useEffect(() => {
    if (viewPackageRequested && cartItems.length > 0) {
      const activePkg = cartItems.find((item) => item.isPlannerPackage);
      if (activePkg && activePkg.plannerData) {
        setPlannerData(activePkg.plannerData);
        setActiveStep("bom");
      }
    }

    const planId = queryParams.get("load_plan");
    if (planId) {
      async function fetchPlanOnline() {
        try {
          const docRef = doc(db, "plans", planId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const plan = docSnap.data();
            if (plan && plan.canvasState) {
              setPlannerData(plan.plannerData || null);
              setSavedCanvasState(plan.canvasState);
              setActiveStep("canvas");
            }
          } else {
            // Fallback to local storage if not found online
            const allPlans = JSON.parse(
              localStorage.getItem("gartenparadies_saved_plans") || "[]",
            );
            const plan = allPlans.find((p: any) => p.id === planId);
            if (plan && plan.canvasState) {
              setPlannerData(plan.plannerData || null);
              setSavedCanvasState(plan.canvasState);
              setActiveStep("canvas");
            }
          }
        } catch (e) {
          console.error("Failed online plan retrieval, falling back:", e);
          const allPlans = JSON.parse(
            localStorage.getItem("gartenparadies_saved_plans") || "[]",
          );
          const plan = allPlans.find((p: any) => p.id === planId);
          if (plan && plan.canvasState) {
            setPlannerData(plan.plannerData || null);
            setSavedCanvasState(plan.canvasState);
            setActiveStep("canvas");
          }
        }
      }
      fetchPlanOnline();
    }
  }, [viewPackageRequested, cartItems, location.search]);

  // Custom materials quantity and pressure states
  const [customRows, setCustomRows] = useState<any[] | null>(null);
  const [lastBOMDetails, setLastBOMDetails] = useState<{
    isSelbstbau: boolean;
    data: PlannerData | null;
  }>({ isSelbstbau: false, data: null });
  const [reducedPressure, setReducedPressure] = useState<string>("2.0");
  const [reducedPressureError, setReducedPressureError] = useState<string>("");
  const [reducePressureActive, setReducePressureActive] =
    useState<boolean>(false);

  // Ordering modal states
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSpinner, setOrderSpinner] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    email: "info@as-mietwagen-service.de", // Prepopulated from user metadata
    street: "",
    zip: "",
    city: "",
    phone: "",
    paymentMethod: "rechnung",
  });

  const handleNext = (data: PlannerData) => {
    setPlannerData(data);
    setActiveStep("bom");
  };

  // Helper to generate initial list of rows with buffers & automated accessories
  const generateBOMRows = (
    data: PlannerData,
    selbstbauMode: boolean,
    productsList: Product[],
  ) => {
    const getItemByLegacyId = (articleNumber: string, defaultName: string) => {
      const p = productsList.find((p) => p.articleNumber === articleNumber);
      return {
        name: p ? p.name : defaultName,
        price: p ? p.price : 0,
        articleNumber,
      };
    };

    const findPlannerItem = (
      type: string,
      defaultName: string,
      minStations?: number,
      minWires?: number,
    ) => {
      let matches = productsList.filter((p) => p.plannerType === type);

      if (type === "assembled_box" && minStations !== undefined) {
        matches = matches.filter(
          (p) => (p.plannerStations || 0) >= minStations,
        );
        matches.sort(
          (a, b) => (a.plannerStations || 0) - (b.plannerStations || 0),
        );
      }

      if (type === "controller" && minStations !== undefined) {
        matches = matches.filter(
          (p) => (p.plannerStations || 0) >= minStations,
        );
        matches.sort(
          (a, b) => (a.plannerStations || 0) - (b.plannerStations || 0),
        );
      }

      if (type === "cable" && minWires !== undefined) {
        matches = matches.filter((p) => (p.plannerWires || 0) >= minWires);
        matches.sort((a, b) => (a.plannerWires || 0) - (b.plannerWires || 0));
      }

      const p = matches[0];
      return {
        name: p ? p.name : defaultName,
        price: p ? p.price : 0,
        articleNumber: p ? p.articleNumber : "",
      };
    };

    const list: any[] = [];

    // --- PE Pipes Sized: 25mm, 32mm, 40mm (with 10% safety buffer) ---
    let len25 = Math.ceil(
      (data.pePipeLength25Meters !== undefined
        ? data.pePipeLength25Meters
        : data.pePipeLengthMeters) * 1.1,
    );
    let len32 = Math.ceil((data.pePipeLength32Meters || 0) * 1.1);
    let len40 = Math.ceil((data.pePipeLength40Meters || 0) * 1.1);

    // Round up PE Rohr to next 25m
    if (len25 > 0) len25 = Math.ceil(len25 / 25) * 25;
    if (len32 > 0) len32 = Math.ceil(len32 / 25) * 25;
    if (len40 > 0) len40 = Math.ceil(len40 / 25) * 25;

    if (len25 > 0) {
      const p = findPlannerItem("pe_pipe", "PE-Rohr PN10 25mm");
      const priceFinal = p.price > 0 ? p.price : 1.5;
      const artNum = p.articleNumber || "PL-PIPE-25";
      list.push({
        id: "planner-pipe-25",
        name: p.name || "PE-Rohr PN10 25mm",
        price: priceFinal,
        articleNumber: artNum,
        category: "PE-Rohre",
        quantity: len25,
        unit: "m",
        isBuffered: true,
        bufferPercent: 10,
        origQuantity:
          data.pePipeLength25Meters !== undefined
            ? data.pePipeLength25Meters
            : data.pePipeLengthMeters,
      });

      // Automatic End caps for PE pipe 25mm - 1 for each main loop end (defaults safely to data.zones)
      const zonesCount = Math.max(1, data.zones || 1);
      list.push({
        id: "planner-end-25",
        name: "Klemmverschraubung Endkappe 25mm",
        price: 3.5,
        articleNumber: "PL-END-25",
        category: "Fittinge",
        quantity: zonesCount,
        unit: "Stk",
      });
    }

    if (len32 > 0) {
      const p = findPlannerItem("pe_pipe", "PE-Rohr PN10 32mm");
      const priceFinal = p.price > 0 ? p.price : 2.2;
      list.push({
        id: "planner-pipe-32",
        name: "PE-Rohr PN10 32mm",
        price: priceFinal,
        articleNumber: p.articleNumber || "PL-PIPE-32",
        category: "PE-Rohre",
        quantity: len32,
        unit: "m",
        isBuffered: true,
        bufferPercent: 10,
        origQuantity: data.pePipeLength32Meters || 0,
      });

      // Automatic End caps for PE pipe 32mm
      const zonesCount = Math.max(1, data.zones || 1);
      list.push({
        id: "planner-end-32",
        name: "Klemmverschraubung Endkappe 32mm",
        price: 4.2,
        articleNumber: "PL-END-32",
        category: "Fittinge",
        quantity: zonesCount,
        unit: "Stk",
      });
    }

    if (len40 > 0) {
      list.push({
        id: "planner-pipe-40",
        name: "PE-Rohr PN10 40mm",
        price: 3.5,
        articleNumber: "PL-PIPE-40",
        category: "PE-Rohre",
        quantity: len40,
        unit: "m",
        isBuffered: true,
        bufferPercent: 10,
        origQuantity: data.pePipeLength40Meters || 0,
      });

      // Automatic End caps for PE pipe 40mm
      const zonesCount = Math.max(1, data.zones || 1);
      list.push({
        id: "planner-end-40",
        name: "Klemmverschraubung Endkappe 40mm",
        price: 5.8,
        articleNumber: "PL-END-40",
        category: "Fittinge",
        quantity: zonesCount,
        unit: "Stk",
      });
    }

    // --- Soft PE Flex pipe for Sprinklers (with 10% safety buffer) ---
    let softPeLength = Math.ceil((data.softPePipeLengthMeters || 0) * 1.1);
    if (softPeLength > 0) softPeLength = Math.ceil(softPeLength / 25) * 25;

    if (softPeLength > 0) {
      const p = findPlannerItem("soft_pipe", "PE-Rohr weich 16mm");
      const priceFinal = p.price > 0 ? p.price : 0.9;
      list.push({
        id: "planner-soft-pipe-16",
        name: p.name || "PE-Rohr weich 16mm (Regnerzuleitung)",
        price: priceFinal,
        articleNumber: p.articleNumber || "PL-PIPE-SOFT-16",
        category: "PE-Rohre weich",
        quantity: softPeLength,
        unit: "m",
        isBuffered: true,
        bufferPercent: 10,
        origQuantity: data.softPePipeLengthMeters || 0,
      });
    }

    // --- Fitting Transitions to 16mm soft PE ---
    let softPeConns = data.softPeConnections || 0;
    const conn25 =
      data.connectors25Count !== undefined
        ? data.connectors25Count
        : softPeConns;
    const conn32 = data.connectors32Count || 0;
    const conn40 = data.connectors40Count || 0;

    if (conn25 > 0) {
      const p = findPlannerItem(
        "connector_25_16",
        "Verbinder PE-Rohr 25mm x PE-Rohr weich 16mm",
      );
      const priceFinal = p.price > 0 ? p.price : 3.5;
      list.push({
        id: "planner-connector-25-16",
        name: p.name || "Verbinder PE-Rohr 25mm x PE-Rohr weich 16mm",
        price: priceFinal,
        articleNumber: p.articleNumber || "PL-CONN-25-16",
        category: "Planer Artikel",
        quantity: conn25,
        unit: "Stk",
      });
    }

    if (conn32 > 0) {
      list.push({
        id: "planner-connector-32-16",
        name: "Verbinder PE-Rohr 32mm x PE-Rohr weich 16mm",
        price: 4.2,
        articleNumber: "PL-CONN-32-16",
        category: "Planer Artikel",
        quantity: conn32,
        unit: "Stk",
      });
    }

    if (conn40 > 0) {
      list.push({
        id: "planner-connector-40-16",
        name: "Verbinder PE-Rohr 40mm x PE-Rohr weich 16mm",
        price: 5.5,
        articleNumber: "PL-CONN-40-16",
        category: "Planer Artikel",
        quantity: conn40,
        unit: "Stk",
      });
    }

    // --- Tropfschläuche (Drip tubes) with 10% safety buffer ---
    let dripLength = Math.ceil((data.dripTubesMeters || 0) * 1.1);
    if (dripLength > 0) dripLength = Math.ceil(dripLength / 25) * 25;

    if (dripLength > 0) {
      const p = findPlannerItem("drip_tube", "Tropfschlauch XFD 16mm");
      const priceFinal = p.price > 0 ? p.price : 1.2;
      list.push({
        id: "planner-drip-tube",
        name: p.name || "Tropfschlauch XFD 16mm",
        price: priceFinal,
        articleNumber: p.articleNumber || "PL-DRIP-16",
        category: "Planer Artikel",
        quantity: dripLength,
        unit: "m",
        isBuffered: true,
        bufferPercent: 10,
        origQuantity: data.dripTubesMeters || 0,
      });

      // Pro Tropfschlauch ein stop-cap: "pro Tropfrohr auch ein Artikel Lock End 16mm"
      list.push({
        id: "planner-lock-end-16",
        name: "Lock End 16mm Endstopfen (Tropfleitung)",
        price: 1.9,
        articleNumber: "PL-LOCK-END-16",
        category: "Planer Artikel",
        quantity: 1,
        unit: "Stk",
      });
    }

    // --- Sprinklers & Accessories ---
    if (data.sprinklers > 0) {
      if (!selbstbauMode) {
        const p = findPlannerItem("sprinkler", "Sprüh-/Getrieberegner Set");
        list.push({
          id: "planner-sprinkler-set",
          name: p.name || "Sprüh-/Getrieberegner Set",
          price: p.price > 0 ? p.price : 18.9,
          articleNumber: p.articleNumber || "PL-SPR-01",
          category: "Planer Artikel",
          quantity: data.sprinklers,
          unit: "Stk",
        });
      } else {
        const details = data.sprinklerDetails || [];
        const endpointsCount = details.filter((s) => s.isEndPoint).length;
        const middlesCount = details.filter((s) => !s.isEndPoint).length;

        const elb25 =
          data.elbows25Count !== undefined
            ? data.elbows25Count
            : endpointsCount;
        const elb32 = data.elbows32Count || 0;
        const elb40 = data.elbows40Count || 0;

        if (elb25 > 0) {
          const p = findPlannerItem(
            "elbow_25_12",
            'Klemmverschraubung Winkel 25mm x 1/2" Innengewinde',
          );
          list.push({
            id: "planner-elbow-25-12",
            name:
              p.name || 'Klemmverschraubung Winkel 25mm x 1/2" Innengewinde',
            price: p.price > 0 ? p.price : 4.5,
            articleNumber: p.articleNumber || "PL-FITTING-ELBOW-25",
            category: "Planer Artikel",
            quantity: elb25,
            unit: "Stk",
          });
        }

        if (elb32 > 0) {
          list.push({
            id: "planner-elbow-32-12",
            name: 'Klemmverschraubung Winkel 32mm x 1/2" Innengewinde',
            price: 5.9,
            articleNumber: "PL-FITTING-ELBOW-32",
            category: "Planer Artikel",
            quantity: elb32,
            unit: "Stk",
          });
        }

        if (elb40 > 0) {
          list.push({
            id: "planner-elbow-40-12",
            name: 'Klemmverschraubung Winkel 40mm x 1/2" Innengewinde',
            price: 7.9,
            articleNumber: "PL-FITTING-ELBOW-40",
            category: "Planer Artikel",
            quantity: elb40,
            unit: "Stk",
          });
        }

        const tp25 =
          data.tPieces25Count !== undefined
            ? data.tPieces25Count
            : middlesCount;
        const tp32 = data.tPieces32Count || 0;
        const tp40 = data.tPieces40Count || 0;

        if (tp25 > 0) {
          const p = findPlannerItem(
            "t_piece_25_12_25",
            'Klemmverschraubung T-Stück 25mm x 1/2" Innengewinde x 25mm',
          );
          list.push({
            id: "planner-t-piece-25-12-25",
            name:
              p.name ||
              'Klemmverschraubung T-Stück 25mm x 1/2" Innengewinde x 25mm',
            price: p.price > 0 ? p.price : 5.9,
            articleNumber: p.articleNumber || "PL-FITTING-TPE-25",
            category: "Planer Artikel",
            quantity: tp25,
            unit: "Stk",
          });
        }

        if (tp32 > 0) {
          list.push({
            id: "planner-t-piece-32-12-32",
            name: 'Klemmverschraubung T-Stück 32mm x 1/2" Innengewinde x 32mm',
            price: 6.9,
            articleNumber: "PL-FITTING-TPE-32",
            category: "Planer Artikel",
            quantity: tp32,
            unit: "Stk",
          });
        }

        if (tp40 > 0) {
          list.push({
            id: "planner-t-piece-40-12-40",
            name: 'Klemmverschraubung T-Stück 40mm x 1/2" Innengewinde x 40mm',
            price: 8.9,
            articleNumber: "PL-FITTING-TPE-40",
            category: "Planer Artikel",
            quantity: tp40,
            unit: "Stk",
          });
        }

        // Swing Joints
        const pSwing = findPlannerItem(
          "swing_joint",
          'Swing Joint 1/2" Aussengewinde x 1/2" Aussengewinde',
        );
        list.push({
          id: "planner-swing-joint",
          name:
            pSwing.name ||
            'Swing Joint 1/2" Aussengewinde x 1/2" Aussengewinde',
          price: pSwing.price > 0 ? pSwing.price : 3.2,
          articleNumber: pSwing.articleNumber || "PL-SWING-JT",
          category: "Planer Artikel",
          quantity: data.sprinklers,
          unit: "Stk",
        });

        // Sprinkler Bodies
        const pBody = findPlannerItem(
          "sprinkler_body",
          "Hunter Pro-Spray PRS40 Gehäuse",
        );
        list.push({
          id: "planner-sprinkler-body",
          name: pBody.name || "Hunter Pro-Spray PRS40 Gehäuse",
          price: pBody.price > 0 ? pBody.price : 14.9,
          articleNumber: pBody.articleNumber || "PL-SPR-PRS40",
          category: "Planer Artikel",
          quantity: data.sprinklers,
          unit: "Stk",
        });

        // Selected Nozzles
        const nozzlesMapCount: { [key: string]: number } = {};
        details.forEach((d) => {
          const nameSave = d.nozzleName || "Hunter MP Rotator Düse";
          nozzlesMapCount[nameSave] = (nozzlesMapCount[nameSave] || 0) + 1;
        });

        const findNozzleProduct = (fullName: string) => {
          const nameLower = fullName.toLowerCase();
          let match = productsList.find(
            (p) =>
              p.plannerType === "sprinkler" &&
              p.name.toLowerCase() === nameLower,
          );
          if (!match) {
            match = productsList.find(
              (p) =>
                p.plannerType === "sprinkler" &&
                nameLower.includes(p.name.toLowerCase()),
            );
          }
          if (match) {
            return {
              name: match.name,
              price: match.price,
              articleNumber: match.articleNumber,
            };
          }
          return {
            name: `Hunter MP Rotator Düse - ${fullName}`,
            price: 8.9,
            articleNumber: `HD-MP-${fullName.split(" ")[0] || "DUESE"}`,
          };
        };

        Object.entries(nozzlesMapCount).forEach(([nozzleName, qty]) => {
          const nozzleProd = findNozzleProduct(nozzleName);
          list.push({
            id: `nozzle-${nozzleName.replace(/\s+/g, "-").toLowerCase()}`,
            name: nozzleProd.name,
            price: nozzleProd.price,
            articleNumber: nozzleProd.articleNumber,
            category: "Planer Artikel",
            quantity: qty,
            unit: "Stk",
          });
        });
      }
    }

    // --- Valve control pre-assembly / parts ---
    if (!selbstbauMode) {
      if (data.zones > 0) {
        const p = findPlannerItem(
          "assembled_box",
          `Verteilerbox Komplett-Set (${data.zones} Stationen)`,
          data.zones,
        );
        let finalPrice = p.price;
        if (finalPrice === 0) {
          const boxPrice = 45.0;
          const valvePrice = 24.9 * data.zones;
          const fittingsPrice = 12.0 * data.zones;
          finalPrice = boxPrice + valvePrice + fittingsPrice;
        }
        list.push({
          id: "planner-assembled-box",
          name: p.name || `Verteilerbox Komplett-Set (${data.zones} Stationen)`,
          price: finalPrice,
          articleNumber: p.articleNumber || "PL-VBOX-ASM",
          category: "Planer Artikel",
          quantity: 1,
          unit: "Set",
        });
      }
    } else {
      const totalValves = data.valves > 0 ? data.valves : 0;
      if (totalValves > 0) {
        const p = findPlannerItem("valve", "Magnetventil 24V AC");
        list.push({
          id: "planner-valves",
          name: p.name || "Magnetventil 24V AC",
          price: p.price > 0 ? p.price : 24.9,
          articleNumber: p.articleNumber || "PL-VLV-01",
          category: "Planer Artikel",
          quantity: totalValves,
          unit: "Stk",
        });
      }

      if (data.valveBoxes > 0) {
        const p = findPlannerItem("valve_box", "Verteilerbox (leer)");
        list.push({
          id: "planner-valveboxes",
          name: p.name || "Verteilerbox (leer)",
          price: p.price > 0 ? p.price : 45.0,
          articleNumber: p.articleNumber || "PL-VBOX-01",
          category: "Planer Artikel",
          quantity: data.valveBoxes,
          unit: "Stk",
        });
      }

      if (data.zones > 0) {
        const p = findPlannerItem("fitting", "Standard Fitting Set");
        list.push({
          id: "planner-fittings",
          name: p.name || "Standard Fitting Set",
          price: p.price > 0 ? p.price : 12.0,
          articleNumber: p.articleNumber || "PL-FIT-01",
          category: "Planer Artikel",
          quantity: data.zones,
          unit: "Set",
        });
      }
    }

    // Controller counts and lists as a separate item outside of the assembled distributor box in both modes
    if (data.controllers > 0) {
      const p = findPlannerItem("controller", "Steuergerät", data.zones);
      list.push({
        id: "planner-controllers",
        name: p.name || "Steuergerät",
        price: p.price > 0 ? p.price : 129.9,
        articleNumber: p.articleNumber || "PL-CTRL-01",
        category: "Planer Artikel",
        quantity: data.controllers,
        unit: "Stk",
      });
    }

    // --- Control Cable (with 15% safety buffer) ---
    if (data.cableLengthMeters > 0 && data.zones > 0) {
      const len = Math.ceil(data.cableLengthMeters * 1.15);
      const p = findPlannerItem("cable", `Steuerkabel`, data.cableWires);
      const priceFinal = p.price > 0 ? p.price : 2.5;
      list.push({
        id: "planner-cable",
        name: p.name || `Steuerkabel ${data.cableWires}-adrig`,
        price: priceFinal,
        articleNumber:
          p.articleNumber ||
          `PL-CBL-${data.cableWires.toString().padStart(2, "0")}`,
        category: "Steuerkabel",
        quantity: len,
        unit: "m",
        isBuffered: true,
        bufferPercent: 15,
        origQuantity: data.cableLengthMeters,
      });
    }

    // --- Hunter RZWS Root Watering System ---
    if (data.rzwsCount !== undefined && data.rzwsCount > 0) {
      const p = findPlannerItem("rzws", "Hunter RZWS Wurzelbewässerung");
      const priceFinal = p.price > 0 ? p.price : 29.9;
      list.push({
        id: "planner-rzws",
        name: p.name || "Hunter RZWS Wurzelbewässerung",
        price: priceFinal,
        articleNumber: p.articleNumber || "PL-RZWS",
        category: "Planer Artikel",
        quantity: data.rzwsCount,
        unit: "Stk",
      });
    }

    // --- Teflonband (3 reels in cart by default, manually adjustable) ---
    list.push({
      id: "planner-teflon",
      name: "Gewindedichtband Teflonband (12m Rolle)",
      price: 2.5,
      articleNumber: "PL-TEFLON",
      category: "Verbindungsmittel",
      quantity: 3,
      unit: "Rolle",
    });

    return list;
  };

  // Synchronize dynamic quantities state
  React.useEffect(() => {
    if (activeStep === "bom" && plannerData) {
      if (
        !customRows ||
        lastBOMDetails.isSelbstbau !== isSelbstbau ||
        lastBOMDetails.data !== plannerData
      ) {
        setCustomRows(generateBOMRows(plannerData, isSelbstbau, products));
        setLastBOMDetails({ isSelbstbau, data: plannerData });

        // Automated pressure reducer checking: If pressure > 3.5 and small garden area (< 200 m²)
        const hasHighPressure = (plannerData.pressure || 3.5) > 3.5;
        const isSmallGarden = (plannerData.gardenArea || 0) < 200;
        setReducePressureActive(hasHighPressure && isSmallGarden);
      }
    } else {
      setCustomRows(null);
    }
  }, [activeStep, plannerData, isSelbstbau, products]);

  // Adjust materials quantity helper (+ / - clicks)
  const adjustQuantity = (id: string, delta: number) => {
    if (!customRows) return;
    setCustomRows((prev) => {
      if (!prev) return null;
      return prev.map((r) => {
        if (r.id === id) {
          const newQty = Math.max(0, r.quantity + delta);
          return { ...r, quantity: newQty };
        }
        return r;
      });
    });
  };

  const handleQuantityChange = (id: string, value: number) => {
    if (!customRows) return;
    setCustomRows((prev) => {
      if (!prev) return null;
      return prev.map((r) => {
        if (r.id === id) {
          return { ...r, quantity: Math.max(0, value) };
        }
        return r;
      });
    });
  };

  // Build current processed rows (injecting Druckminderer dynamically if checked)
  const getRenderedRows = () => {
    const defaultList = customRows ? [...customRows] : [];
    if (reducePressureActive) {
      const exists = defaultList.some(
        (r) => r.id === "planner-pressure-reducer",
      );
      if (!exists) {
        const pressureItem = products.find(
          (p) => p.plannerType === "pressure_reducer",
        );
        const pName = pressureItem
          ? pressureItem.name
          : 'Premium Druckminderer 1" (Empfohlen bei hohem Druck)';
        const pPrice = pressureItem ? pressureItem.price : 34.9;
        const pArtNum = pressureItem ? pressureItem.articleNumber : "PL-PR-01";

        defaultList.unshift({
          id: "planner-pressure-reducer",
          name: pName,
          price: pPrice,
          articleNumber: pArtNum,
          category: "Planer Artikel",
          quantity: 1,
          unit: "Stk",
          isPressureReducer: true,
        });
      }
    } else {
      return defaultList.filter((r) => r.id !== "planner-pressure-reducer");
    }
    return defaultList;
  };

  const renderedRows = getRenderedRows();
  const totalSum = renderedRows.reduce(
    (sum, r) => sum + r.price * r.quantity,
    0,
  );

  // Validate reduced pressure (Pflichtfeld)
  const isReducedPressureValid = () => {
    return true;
  };

  // Process checkout order mock submission
  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setOrderSpinner(true);
    setTimeout(() => {
      const rand = Math.floor(10000 + Math.random() * 90000);
      setOrderNumber(`DE-2026-${rand}`);
      setOrderSpinner(false);
      setOrderSuccess(true);
    }, 1200);
  };

  const handlePlannerSaveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !plannerData) return;

    try {
      const planId = savedCanvasState?.id || "plan-" + Date.now();
      const canvasState = savedCanvasState || {
        id: planId,
        shapes: [],
        sprinklers: [],
        pipes: [],
        infraNodes: [],
        manualPipes: [],
        manualDripLines: [],
        manualRzws: [],
        bgImage: null,
        elevationDiff: 0,
        inletPressure: plannerData.pressure || 3.5,
        extraBends: 0,
        step: "calculation",
        scale: 1,
        pan: { x: 0, y: 0 },
      };

      const newPlan = {
        id: planId,
        userId: currentUser.id,
        name: savePlanName || "Mein Bewässerungsplan",
        lastEdited: new Date().toISOString(),
        canvasState,
        plannerData: {
          ...plannerData,
          pressure: plannerData.pressure || 3.5,
        },
        customRows: customRows || null,
        reducePressureActive: reducePressureActive || false,
      };

      const sanitizedPlan = JSON.parse(JSON.stringify(newPlan));

      // Save plan online to Firestore '/plans'
      await setDoc(doc(db, "plans", planId), sanitizedPlan);

      // Save locally as backup
      let plans = [];
      try {
        plans = JSON.parse(
          localStorage.getItem("gartenparadies_saved_plans") || "[]",
        );
      } catch (e) {
        plans = [];
      }

      const existingIdx = plans.findIndex((p: any) => p.id === planId);
      if (existingIdx !== -1) {
        plans[existingIdx] = sanitizedPlan;
      } else {
        plans.push(sanitizedPlan);
      }

      localStorage.setItem("gartenparadies_saved_plans", JSON.stringify(plans));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsSaveModalOpen(false);
      }, 1500);
    } catch (e: any) {
      console.error(e);
      alert("Fehler beim Cloud-Speichern des Plans: " + e.message);
    }
  };

  const handlePlannerAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (isRegistering) {
      if (!regEmail || !regPassword) {
        setAuthError("Bitte fülle E-Mail und Passwort aus.");
        return;
      }
      if (regPassword !== regPasswordRepeat) {
        setAuthError("Die Passwörter stimmen nicht überein.");
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          regEmail,
          regPassword,
        );
        const fbUser = userCredential.user;
        const newUser = {
          id: fbUser.uid,
          username: regUsername || regEmail.split("@")[0],
          email: regEmail,
          name: regName || regUsername || regEmail.split("@")[0],
        };

        await setDoc(doc(db, "users", fbUser.uid), newUser);

        if (setCurrentUser) {
          setCurrentUser(newUser);
        }

        setIsPlannerAuthModalOpen(false);
        setSavePlanName(`Plan - ${new Date().toLocaleDateString("de-DE")}`);
        setIsSaveModalOpen(true);
      } catch (err: any) {
        console.error("Registration failed:", err);
        setAuthError(err.message || "Registrierung fehlgeschlagen.");
      }
    } else {
      if (!loginUsername || !loginPassword) {
        setAuthError("Bitte fülle alle Login-Felder aus.");
        return;
      }

      if (loginUsername === "admin" && loginPassword === "admin") {
        if (setCurrentUser)
          setCurrentUser({
            id: "admin",
            email: "admin",
            name: "Administrator",
            username: "admin",
          });
        setIsPlannerAuthModalOpen(false);
        setSavePlanName(`Plan - ${new Date().toLocaleDateString("de-DE")}`);
        setIsSaveModalOpen(true);
        return;
      }

      try {
        let emailToLogin = loginUsername.trim();
        if (!emailToLogin.includes("@")) {
          const q = query(
            collection(db, "users"),
            where("username", "==", emailToLogin),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            emailToLogin = snap.docs[0].data().email;
          }
        }
        const userCredential = await signInWithEmailAndPassword(
          auth,
          emailToLogin,
          loginPassword,
        );
        const fbUser = userCredential.user;

        const docRef = doc(db, "users", fbUser.uid);
        const docSnap = await getDoc(docRef);
        let userData = {
          id: fbUser.uid,
          username: fbUser.email?.split("@")[0] || "user",
          email: fbUser.email || "",
          name: fbUser.displayName || fbUser.email?.split("@")[0] || "Kunde",
        };

        if (docSnap.exists()) {
          userData = { ...userData, ...docSnap.data() };
        }

        if (setCurrentUser) {
          setCurrentUser(userData);
        }
        setIsPlannerAuthModalOpen(false);
        setSavePlanName(`Plan - ${new Date().toLocaleDateString("de-DE")}`);
        setIsSaveModalOpen(true);
      } catch (err: any) {
        console.error("Login failed:", err);
        setAuthError("Benutzername/E-Mail oder Passwort falsch.");
      }
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (activeStep === "canvas") {
    return (
      <PlannerCanvas
        onBack={() => {
          setSavedCanvasState(null);
          navigate("/");
        }}
        onNext={(data, rawState) => {
          setSavedCanvasState(rawState);
          handleNext(data);
        }}
        initialState={savedCanvasState}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />
    );
  }

  if (activeStep === "bom" && plannerData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200 w-full p-3 sm:p-4 print:hidden">
            <div className="max-w-[1000px] mx-auto flex items-center justify-between">
              <button
                onClick={() => setActiveStep("canvas")}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <span className="hidden sm:inline">Zurück zum Plan</span>
                <span className="sm:hidden">Zurück</span>
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold transition-colors shadow-sm text-xs sm:text-sm"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Drucken / PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                  >
                    {currentUser ? (
                      <span className="text-sm font-bold uppercase">
                        {currentUser.name[0]}
                      </span>
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </button>

                  {isUserDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-150 overflow-hidden z-50 p-4">
                      {currentUser ? (
                        <div className="space-y-3 text-left">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">
                            Mein Konto
                          </p>
                          <div>
                            <p className="text-sm font-bold text-gray-800 font-sans">
                              {currentUser.name}
                            </p>
                            <p className="text-xs text-gray-500 font-sans">
                              {currentUser.email}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setIsSavedPlansModalOpen(true);
                            }}
                            className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Meine Pläne</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await signOut(auth);
                              } catch (e) {}
                              if (setCurrentUser) setCurrentUser(null);
                              setIsUserDropdownOpen(false);
                            }}
                            className="w-full bg-red-50 text-red-650 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-100 transition-colors cursor-pointer font-sans font-bold"
                          >
                            Abmelden
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 text-left">
                          <p className="text-xs text-gray-500 font-sans font-medium">
                            Du bist nicht angemeldet.
                          </p>
                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setIsPlannerAuthModalOpen(true);
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer text-center font-sans"
                          >
                            Anmelden / Registrieren
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-[1000px] mx-auto w-full px-3 py-6 sm:py-8">
            <div
              id="bom-container"
              className="bg-white p-4 sm:p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
                    Dein Bewässerungsplan
                  </h1>
                  <p className="text-gray-500 text-sm mt-0.5 font-medium">
                    Artikelübersicht, Mengen & Bestellung
                  </p>
                </div>
              </div>

              {/* Informational specs grids */}
              <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 justify-between border border-gray-100">
                <div>
                  <span className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                    Zonen
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-gray-900">
                    {plannerData.zones}
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                    Regner
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-gray-900">
                    {plannerData.sprinklers}
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                    PE-Rohr
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-gray-900">
                    {Math.ceil(plannerData.pePipeLengthMeters)}m
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                    Tropfschlauch
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-gray-900">
                    {Math.ceil(plannerData.dripTubesMeters)}m
                  </span>
                </div>
              </div>

              {/* Verteilerbox Assembly options selecting */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-sm sm:text-base">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[#1388C9] animate-pulse"></span>
                    Montageart der Verteilerbox
                  </h4>
                  <p className="text-gray-500 text-xs mt-1 leading-snug">
                    Wähle, ob Du die Box bezugsfertig vormontiert (inkl.
                    vormontierter Ventile, Anschlüsse & Steuergerät) oder alle
                    Einzelteile unmontiert erhalten möchtest.
                  </p>
                </div>
                <div className="flex bg-gray-100/80 p-1 rounded-xl shrink-0 self-start md:self-auto shadow-inner border border-gray-200/40">
                  <button
                    onClick={() => setIsSelbstbau(false)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${!isSelbstbau ? "bg-white text-[#1388C9] shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    Vormontiert (Empfohlen)
                  </button>
                  <button
                    onClick={() => setIsSelbstbau(true)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${isSelbstbau ? "bg-white text-[#1388C9] shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    Selbstbau (Einzelteile)
                  </button>
                </div>
              </div>

              {/* Dynamic pressure reducer trigger configurations */}
              <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-blue-500 shrink-0" />
                      Druck- und Gartenanalyse
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Aktueller Eingangsdruck:{" "}
                      <strong className="font-semibold">
                        {plannerData.pressure?.toFixed(1) || "3.5"} bar
                      </strong>{" "}
                      (Gartenfläche:{" "}
                      <strong className="font-semibold">
                        {Math.round(plannerData.gardenArea || 0)} m²
                      </strong>
                      )
                      {plannerData.pressure && plannerData.pressure > 3.5 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 inline-block animate-pulse shrink-0 ml-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          Empfehlung: Druckminderer hinzufügen
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                    <input
                      id="toggle-reducer"
                      type="checkbox"
                      checked={reducePressureActive}
                      onChange={(e) => {
                        setReducePressureActive(e.target.checked);
                        setReducedPressureError("");
                      }}
                      className="h-4 w-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor="toggle-reducer"
                      className="text-xs sm:text-sm font-bold text-gray-700 cursor-pointer select-none"
                    >
                      Druckminderer hinzufügen
                    </label>
                  </div>
                </div>

                {false && reducePressureActive && (
                  <div className="flex flex-wrap items-center bg-amber-50 rounded-xl p-3 border border-amber-100 gap-3">
                    <div className="flex items-center gap-2 text-amber-800 text-xs flex-1 min-w-[200px]">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Eingangsdruck &gt; 3,5 bar & kleiner Garten. Reduzierter
                        Druck ist ein <strong>Pflichtfeld:</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-gray-700">
                        Reduziert auf:
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="3.5"
                          value={reducedPressure}
                          onChange={(e) => {
                            const v = e.target.value;
                            setReducedPressure(v);
                            const num = parseFloat(v);
                            if (!v || isNaN(num) || num < 1.0 || num > 3.5) {
                              setReducedPressureError(
                                "Wert zwischen 1.0 & 3.5 bar erforderlich.",
                              );
                            } else {
                              setReducedPressureError("");
                            }
                          }}
                          className={`w-24 px-2 py-1 text-xs font-bold bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${reducedPressureError ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                          placeholder="Druck"
                          required
                        />
                        <span className="absolute right-2 top-1 text-[10px] text-gray-400 font-bold">
                          bar
                        </span>
                      </div>
                    </div>
                    {reducedPressureError && (
                      <span className="block w-full text-red-600 text-[11px] font-bold pl-6">
                        {reducedPressureError}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {plannerData.svgSnapshot && (
                <div
                  className="relative mb-8 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm flex justify-center items-center h-[280px] sm:h-[400px] w-full"
                  dangerouslySetInnerHTML={{
                    __html: plannerData.svgSnapshot.replace(
                      /absolute inset-0/g,
                      "",
                    ),
                  }}
                />
              )}

              {/* MOBILES RENDER - VERHINDERT HORIZONTALES WISCHEN / NO ROTATE NEEDED */}
              <div className="md:hidden space-y-4">
                <span className="text-xs text-gray-400 font-extrabold uppercase tracking-wide block mb-1">
                  Deine Artikelübersicht (Mobil-Ansicht)
                </span>
                {renderedRows.map((row) => (
                  <div
                    key={row.id}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#1388C9] block">
                          {row.category}
                        </span>
                        <span className="font-bold text-gray-900 text-sm leading-snug">
                          {row.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono block mt-0.5">
                          SKU: {row.articleNumber}
                        </span>
                        {row.isBuffered && (
                          <span className="inline-block bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 border border-teal-100">
                            +{row.bufferPercent}% Puffer eingerechnet
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-medium">
                          Einzelpreis
                        </span>
                        <span className="text-xs font-semibold text-gray-600">
                          {row.price.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          / {row.unit}
                        </span>
                      </div>

                      {/* Plus/Minus quantity adjustment switches */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjustQuantity(row.id, -1)}
                          className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition"
                          type="button"
                        >
                          <Minus className="w-3 h-3 font-black" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={row.quantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              row.id,
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-10 text-center border border-gray-200 rounded-lg py-1 px-1 font-bold text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-500 font-medium w-6 text-left shrink-0">
                          {row.unit}
                        </span>
                        <button
                          onClick={() => adjustQuantity(row.id, 1)}
                          className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition"
                          type="button"
                        >
                          <Plus className="w-3 h-3 font-black" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-50 pt-2.5 bg-gray-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                      <span className="text-xs uppercase font-bold text-gray-400">
                        Gesamt
                      </span>
                      <span className="font-extrabold text-gray-950 text-sm">
                        {(row.price * row.quantity).toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP VIEW TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="py-4 px-2 font-semibold text-gray-600">
                        Artikel / Kategorie
                      </th>
                      <th className="py-4 px-2 font-semibold text-gray-600 text-center">
                        Menge
                      </th>
                      <th className="py-4 px-2 font-semibold text-gray-600 text-right">
                        Einzelpreis
                      </th>
                      <th className="py-4 px-2 font-semibold text-gray-600 text-right">
                        Gesamt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderedRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-4 px-2 text-gray-900 font-medium">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {row.name}
                            </div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                              Art.-Nr: {row.articleNumber} | {row.category}
                            </div>
                            {row.isBuffered && (
                              <span className="inline-block bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border border-teal-100">
                                +{row.bufferPercent}% Puffer eingerechnet
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => adjustQuantity(row.id, -1)}
                              className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  row.id,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-14 text-center border border-gray-200 rounded-lg py-1 px-1 font-bold text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-xs text-gray-500 font-medium min-w-[20px] text-left">
                              {row.unit}
                            </span>
                            <button
                              onClick={() => adjustQuantity(row.id, 1)}
                              className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-gray-500 text-right font-medium">
                          {row.price.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </td>
                        <td className="py-4 px-2 text-gray-900 font-bold text-right">
                          {(row.price * row.quantity).toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Row Footer */}
              <div className="border-t-2 border-gray-100 py-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400 block">
                    Kalkulierte Gesamtartikel
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {renderedRows.filter((r) => r.quantity > 0).length}{" "}
                    eindeutige Positionen
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-right font-semibold text-gray-500 text-base">
                    Gesamtsumme inkl. MwSt.
                  </span>
                  <span className="block text-right font-black text-emerald-600 text-2xl sm:text-3xl">
                    {totalSum.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </span>
                </div>
              </div>

              {/* High pressure reducer recommendation banner at the bottom (am Schluss) */}
              {plannerData && (plannerData.pressure || 3.5) > 3.5 && (
                <div className="mb-6 p-4 rounded-2xl border bg-gradient-to-r from-amber-50 to-orange-50/35 border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                  <div className="flex gap-3 items-start sm:items-center">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-sm">
                        Empfehlung für Deinen Garten
                      </h4>
                      <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                        Dein Wasserdruck liegt bei{" "}
                        <strong className="font-black">
                          {plannerData.pressure?.toFixed(1) || "3.8"} bar
                        </strong>
                        . Um Schäden an Tropfrohren und Regnern zu vermeiden,
                        empfehlen wir unseren vorkonfigurierten 1"
                        Druckminderer.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setReducePressureActive(!reducePressureActive)
                    }
                    className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition duration-200 select-none shrink-0 ${reducePressureActive ? "bg-amber-600 text-white shadow-sm hover:bg-amber-700" : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100/50 hover:border-amber-400"}`}
                  >
                    {reducePressureActive ? "✓ Hinzugefügt" : "+ Hinzufügen"}
                  </button>
                </div>
              )}

              {/* Ordering / Checkout button section */}
              <div className="mt-6 border-t border-dashed border-gray-100 pt-6 flex flex-col sm:flex-row justify-end gap-4 print:hidden">
                <button
                  onClick={() => {
                    if (!currentUser) {
                      setIsPlannerAuthModalOpen(true);
                    } else {
                      setSavePlanName(
                        `Plan - ${new Date().toLocaleDateString("de-DE")}`,
                      );
                      setIsSaveModalOpen(true);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-250 hover:bg-slate-200 font-extrabold text-sm rounded-xl transition shadow-xs active:scale-95 w-full sm:w-auto cursor-pointer font-sans"
                >
                  <Save className="w-4 h-4 text-slate-600" />
                  Plan speichern
                </button>
                <button
                  onClick={() => {
                    if (!isReducedPressureValid()) {
                      setReducedPressureError(
                        "Bitte gib einen korrekten reduzierten Druck an (Pflichtfeld)",
                      );
                      return;
                    }
                    if (onAddToCart && plannerData) {
                      const planProduct = {
                        id: "planner-package-active",
                        name: "Plan-Paket im Warenkorb",
                        description: `Dein berechnetes Bewässerungssystem: ${plannerData.zones} Zonen, ${plannerData.sprinklers} Regner, PE-Rohre und Fittings. Gesamtgarten: ${Math.round(plannerData.gardenArea || 0)} m².`,
                        price: totalSum,
                        category: "Planer Artikel",
                        imageUrl:
                          "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=400&auto=format&fit=crop",
                        stock: 9999,
                        articleNumber: "PL-PAKET-CUSTOM",
                        metaTitle: "Plan-Paket",
                        metaDescription: "",
                        metaAdsText: "",
                        variations: [],
                      };
                      onAddToCart(planProduct, {}, 1, {
                        isPlannerPackage: true,
                        plannerData: plannerData,
                      });
                      if (onOpenCart) {
                        onOpenCart();
                      }
                    }
                  }}
                  disabled={!isReducedPressureValid()}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-50 border-2 border-blue-200 text-blue-800 hover:bg-blue-100 hover:border-blue-400 font-extrabold text-sm rounded-xl transition shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer font-sans"
                >
                  <ShoppingCart className="w-4 h-4" />
                  In den Warenkorb legen
                </button>

                <button
                  onClick={() => {
                    if (!isReducedPressureValid()) {
                      setReducedPressureError(
                        "Bitte gib einen korrekten reduzierten Druck an (Pflichtfeld)",
                      );
                      return;
                    }
                    setIsOrderModalOpen(true);
                  }}
                  disabled={!isReducedPressureValid()}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer font-sans"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Direkt bestellen
                </button>
              </div>
            </div>
          </main>

          {/* SECURE MODAL FOR ORDER COMPLETION & CHECKOUT */}
          {isOrderModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in block">
              <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 relative">
                {/* Close button */}
                <button
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    setOrderSuccess(false);
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-950 transition p-1.5 hover:bg-gray-50 rounded-full"
                >
                  <span className="text-xl font-bold font-sans">&times;</span>
                </button>

                {!orderSuccess ? (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-gray-950">
                          Bestellung abschließen
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Sichere Verbindung zu Deinem Bewässerungspartner
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 mb-5 flex justify-between items-center">
                      <div>
                        <span className="text-xs text-emerald-800 font-bold block">
                          Gesamtsumme inkl. Puffer
                        </span>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">
                          {renderedRows.filter((r) => r.quantity > 0).length}{" "}
                          Posten berechnet
                        </span>
                      </div>
                      <span className="text-lg font-black text-emerald-700">
                        {totalSum.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>

                    <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Name, Vorname{" "}
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.name}
                          onChange={(e) =>
                            setCheckoutForm({
                              ...checkoutForm,
                              name: e.target.value,
                            })
                          }
                          className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                          placeholder="Max Mustermann"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          E-Mail-Adresse{" "}
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={checkoutForm.email}
                          onChange={(e) =>
                            setCheckoutForm({
                              ...checkoutForm,
                              email: e.target.value,
                            })
                          }
                          className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                          placeholder="max@beispiel.de"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Straße & Hausnr.{" "}
                            <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={checkoutForm.street}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                street: e.target.value,
                              })
                            }
                            className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                            placeholder="Hauptstraße 42"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Telefonnummer
                          </label>
                          <input
                            type="text"
                            value={checkoutForm.phone}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                phone: e.target.value,
                              })
                            }
                            className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                            placeholder="0123 / 456789"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            PLZ{" "}
                            <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={checkoutForm.zip}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                zip: e.target.value,
                              })
                            }
                            className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                            placeholder="12345"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Stadt / Ort{" "}
                            <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={checkoutForm.city}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                city: e.target.value,
                              })
                            }
                            className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                            placeholder="Musterstadt"
                          />
                        </div>
                      </div>

                      {reducePressureActive && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                          <span className="font-bold text-amber-900 block uppercase tracking-wider mb-0.5">
                            Druckregulierung aktiv:
                          </span>
                          Ein passender Druckminderer wird Deiner Bestellung
                          hinzugefügt.
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Zahlungsart
                        </label>
                        <select
                          value={checkoutForm.paymentMethod}
                          onChange={(e) =>
                            setCheckoutForm({
                              ...checkoutForm,
                              paymentMethod: e.target.value,
                            })
                          }
                          className="w-full p-2.5 text-sm rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          <option value="rechnung">
                            Rechnung (Lieferung auf Rechnung)
                          </option>
                          <option value="paypal">PayPal</option>
                          <option value="vorkasse">Vorkasse</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400 font-semibold leading-relaxed">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        Geprüfte SSL-Kundenbestellung. Datenschutzbestimmungen
                        gelten vollumfänglich.
                      </div>

                      <div className="border-t border-gray-100 pt-4 mt-6 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setIsOrderModalOpen(false)}
                          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition text-xs"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="submit"
                          disabled={orderSpinner}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-black transition text-xs shadow-md flex items-center justify-center gap-2"
                        >
                          {orderSpinner ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Wird gesendet...
                            </>
                          ) : (
                            "Kostenpflichtig Bestellen"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* SENSATIONAL ORDER SUCCESS STATE */
                  <div className="text-center py-6 animate-fade-in">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 leading-snug">
                      Vielen Dank für Deine Bestellung!
                    </h2>
                    <p className="text-gray-500 text-xs mt-1.5 font-medium">
                      Dein Bewässerungsequipment wird optimal zusammengestellt.
                    </p>

                    <div className="border border-dashed border-gray-200 bg-gray-50 rounded-2xl p-4 my-6 text-left space-y-2">
                      <div className="flex justify-between text-xs pb-1.5 border-b border-gray-200/50">
                        <span className="text-gray-400 uppercase font-bold">
                          Bestellnummer:
                        </span>
                        <span className="font-mono font-extrabold text-gray-900">
                          {orderNumber}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-gray-400 uppercase font-bold">
                          Empfänger:
                        </span>
                        <span className="font-bold text-gray-800">
                          {checkoutForm.name}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 uppercase font-bold">
                          E-Mail:
                        </span>
                        <span className="font-bold text-gray-800">
                          {checkoutForm.email}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 uppercase font-bold">
                          Lieferadresse:
                        </span>
                        <span className="font-bold text-gray-800 text-right text-xs">
                          {checkoutForm.street}, {checkoutForm.zip}{" "}
                          {checkoutForm.city}
                        </span>
                      </div>
                      {reducePressureActive && (
                        <div className="flex justify-between text-xs text-amber-700">
                          <span className="uppercase font-bold text-amber-500">
                            Druckregulierung:
                          </span>
                          <strong className="font-extrabold text-sky-600">
                            Druckminderer inklusive
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between text-xs pt-1.5 border-t border-gray-200/50 font-sans">
                        <span className="text-gray-950 font-black text-sm">
                          Gesamtsumme:
                        </span>
                        <span className="font-black text-emerald-600 text-sm">
                          {totalSum.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 font-medium leading-relaxed max-w-sm mx-auto mb-6">
                      Wir haben Dir soeben eine Bestellbestätigung per E-Mail
                      gesendet. Unser Servicekoordinator meldet sich in Kürze
                      mit allen Zahlungs- und Logistikdetails!
                    </div>

                    <button
                      onClick={() => {
                        setIsOrderModalOpen(false);
                        setOrderSuccess(false);
                        navigate("/");
                      }}
                      className="w-full py-3.5 bg-gray-900 hover:bg-gray-950 text-white rounded-xl font-extrabold transition text-xs"
                    >
                      Schließen & Zurück zur Hauptseite
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Saved Plans Modal */}
        <AnimatePresence>
          {isSavedPlansModalOpen && currentUser && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-150 flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-bold text-gray-900">
                      Meine gespeicherten Pläne
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsSavedPlansModalOpen(false)}
                    className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  {onlinePlans.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm mb-4">
                        Du hast noch keine Bewässerungspläne gespeichert.
                      </p>
                      <button
                        onClick={() => {
                          setIsSavedPlansModalOpen(false);
                          setActiveStep("canvas");
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition duration-150 shadow-md cursor-pointer inline-flex items-center gap-2"
                      >
                        Jetzt planen starten
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    onlinePlans.map((plan: any) => (
                      <div
                        key={plan.id}
                        className="p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 select-none text-left">
                          <h4 className="font-bold text-gray-900 text-base">
                            {plan.name}
                          </h4>
                          <p className="text-xs text-gray-400">
                            Zuletzt bearbeitet: {formatLastEdited(plan.lastEdited)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-emerald-700">
                            {plan.plannerData?.sprinklers !== undefined && (
                              <span className="bg-emerald-50 px-2 py-0.5 rounded-md">
                                Regner: {plan.plannerData.sprinklers}
                              </span>
                            )}
                            {plan.plannerData?.zones !== undefined && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                                Zonen: {plan.plannerData.zones}
                              </span>
                            )}
                            {plan.plannerData?.gardenArea !== undefined && (
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                                Fläche: {plan.plannerData.gardenArea} m²
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setIsSavedPlansModalOpen(false);
                              if (plan.canvasState) {
                                setPlannerData(plan.plannerData || null);
                                setSavedCanvasState(plan.canvasState);
                                if (plan.customRows) {
                                  setCustomRows(plan.customRows);
                                } else {
                                  setCustomRows(null);
                                }
                                setReducePressureActive(
                                  plan.reducePressureActive || false,
                                );
                                setActiveStep("canvas");
                              }
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition duration-200 cursor-pointer"
                          >
                            Plan laden
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  "Aufgepasst: Möchtest du diesen Plan wirklich löschen?",
                                )
                              ) {
                                try {
                                  await deleteDoc(doc(db, "plans", plan.id));
                                  setOnlinePlans((prev) =>
                                    prev.filter((p) => p.id !== plan.id),
                                  );
                                } catch (err) {
                                  console.error("Error deleting plan:", err);
                                }
                              }
                            }}
                            className="p-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition duration-200 cursor-pointer"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Planner Registration & Login Auth Modal */}
        <AnimatePresence>
          {isPlannerAuthModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-155 flex flex-col"
              >
                {/* Modal Banner */}
                <div className="p-6 bg-gradient-to-r from-emerald-700 to-teal-600 text-white flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-emerald-300" />
                      <span className="text-xs uppercase font-extrabold tracking-wider opacity-85">
                        Kostenloses Konto
                      </span>
                    </div>
                    <h3 className="text-2xl font-black">
                      {isRegistering ? "Registrieren" : "Anmelden"}
                    </h3>
                    <p className="text-xs text-emerald-100 opacity-90">
                      {isRegistering
                        ? "Erstelle ein Konto, um deinen Bewässerungsplan zu sichern."
                        : "Melde dich an, um deine Pläne zu sichern und abzurufen."}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsPlannerAuthModalOpen(false);
                      setAuthError("");
                    }}
                    className="text-white hover:text-emerald-250 hover:text-emerald-200 p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form body */}
                <form
                  onSubmit={handlePlannerAuthSubmit}
                  className="p-6 space-y-4"
                >
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {isRegistering ? (
                    /* Registration fields */
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          Benutzername *
                        </label>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="z.B. gartenfreund"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          E-Mail-Adresse *
                        </label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="deine@adresse.de"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          Vollständiger Name
                        </label>
                        <input
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="z.B. Max Mustermann"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          Passwort *
                        </label>
                        <input
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-505 uppercase">
                          Passwort wiederholen *
                        </label>
                        <input
                          type="password"
                          required
                          value={regPasswordRepeat}
                          onChange={(e) => setRegPasswordRepeat(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Login fields */
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          Benutzername
                        </label>
                        <input
                          type="text"
                          required
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="Dein Benutzername"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                          Passwort
                        </label>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                          placeholder="Dein Passwort"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md hover:shadow-lg cursor-pointer text-sm"
                    >
                      {isRegistering
                        ? "Registrieren & Weiter"
                        : "Anmelden & Weiter"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setAuthError("");
                      }}
                      className="w-full text-center text-xs text-gray-500 hover:text-emerald-700 font-semibold cursor-pointer"
                    >
                      {isRegistering
                        ? "Bereits registriert? Jetzt anmelden"
                        : "Noch kein Konto? Jetzt registrieren"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200 w-full">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Droplets className="w-6 h-6 text-[#1388C9]" />
              <span className="text-xl font-bold text-gray-900">
                Bewässerungsplaner
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
            >
              {currentUser ? (
                <span className="text-sm font-bold uppercase">
                  {currentUser.name[0]}
                </span>
              ) : (
                <User className="w-5 h-5" />
              )}
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-150 overflow-hidden z-20 p-4">
                {currentUser ? (
                  <div className="space-y-3 text-left">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Mein Konto
                    </p>
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {currentUser.email}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setIsSavedPlansModalOpen(true);
                      }}
                      className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Meine Pläne</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await signOut(auth);
                        } catch (e) {}
                        if (setCurrentUser) setCurrentUser(null);
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full bg-red-50 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-100 transition-colors cursor-pointer font-semibold"
                    >
                      Abmelden
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-left">
                    <p className="text-xs text-gray-500">
                      Du bist nicht angemeldet.
                    </p>
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setIsPlannerAuthModalOpen(true);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Anmelden / Registrieren
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-8 md:p-12 text-center border-b border-gray-100 bg-emerald-900 text-white">
            <h1 className="text-3xl md:text-5xl font-black mb-4">
              Dein perfektes Gartenparadies
            </h1>
            <p className="text-emerald-100 max-w-xl mx-auto text-lg">
              Konfiguriere in wenigen Schritten das optimale Bewässerungssystem
              für deinen garten.
            </p>
          </div>

          <div className="p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 relative">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-center hover:shadow-md transition-shadow cursor-pointer group">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Map className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Fläche einzeichnen
                </h3>
                <p className="text-gray-500 text-sm">
                  Markiere deinen Garten auf einer Karte oder gib die Maße an,
                  um den Bedarf zu ermitteln.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setActiveStep("canvas")}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Starten
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-center hover:shadow-md transition-shadow cursor-pointer group">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Sun className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Bedarfsanalyse
                </h3>
                <p className="text-gray-500 text-sm">
                  Beantworte einige Fragen zu deinen Pflanzen,
                  Sonneneinstrahlung und Bodenart.
                </p>
                <div className="mt-6 flex justify-center">
                  <button className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors">
                    Starten
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Save Plan Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-150 p-6 space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Plan speichern
                </h3>
              </div>

              {saveSuccess ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-emerald-800">
                    Plan erfolgreich gespeichert!
                  </h4>
                  <p className="text-gray-500 text-xs">
                    Du kannst diesen Plan jederzeit über dein Profil aufrufen.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePlannerSaveConfirm} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">
                      Name des Plans
                    </label>
                    <input
                      type="text"
                      required
                      value={savePlanName}
                      onChange={(e) => setSavePlanName(e.target.value)}
                      placeholder="z.B. Mein Vorgarten"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-gray-805 text-gray-800 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSaveModalOpen(false)}
                      className="px-4 py-2.5 bg-gray-105 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-md cursor-pointer"
                    >
                      Speichern
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Plans Modal */}
      <AnimatePresence>
        {isSavedPlansModalOpen && currentUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-55 z-50 p-4 font-sans animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-150 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">
                    Meine gespeicherten Pläne
                  </h3>
                </div>
                <button
                  onClick={() => setIsSavedPlansModalOpen(false)}
                  className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {onlinePlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-4">
                      Du hast noch keine Bewässerungspläne gespeichert.
                    </p>
                    <button
                      onClick={() => {
                        setIsSavedPlansModalOpen(false);
                        setActiveStep("canvas");
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition duration-150 shadow-md cursor-pointer inline-flex items-center gap-2"
                    >
                      Jetzt planen starten
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  onlinePlans.map((plan: any) => (
                    <div
                      key={plan.id}
                      className="p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 select-none text-left">
                        <h4 className="font-bold text-gray-900 text-base">
                          {plan.name}
                        </h4>
                        <p className="text-xs text-gray-400">
                          Zuletzt bearbeitet: {formatLastEdited(plan.lastEdited)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-emerald-700">
                          {plan.plannerData?.sprinklers !== undefined && (
                            <span className="bg-emerald-50 px-2 py-0.5 rounded-md">
                              Regner: {plan.plannerData.sprinklers}
                            </span>
                          )}
                          {plan.plannerData?.zones !== undefined && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                              Zonen: {plan.plannerData.zones}
                            </span>
                          )}
                          {plan.plannerData?.gardenArea !== undefined && (
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                              Fläche: {plan.plannerData.gardenArea} m²
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setIsSavedPlansModalOpen(false);
                            if (plan.canvasState) {
                              setPlannerData(plan.plannerData || null);
                              setSavedCanvasState(plan.canvasState);
                              setActiveStep("canvas");
                            }
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition duration-200 cursor-pointer"
                        >
                          Plan laden
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "Aufgepasst: Möchtest du diesen Plan wirklich löschen?",
                              )
                            ) {
                              try {
                                await deleteDoc(doc(db, "plans", plan.id));
                                setOnlinePlans((prev) =>
                                  prev.filter((p) => p.id !== plan.id),
                                );
                              } catch (err) {
                                console.error("Error deleting plan:", err);
                              }
                            }
                          }}
                          className="p-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition duration-200 cursor-pointer"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Planner Registration & Login Auth Modal */}
      <AnimatePresence>
        {isPlannerAuthModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-155 flex flex-col"
            >
              {/* Modal Banner */}
              <div className="p-6 bg-gradient-to-r from-emerald-700 to-teal-600 text-white flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-emerald-300" />
                    <span className="text-xs uppercase font-extrabold tracking-wider opacity-85">
                      Kostenloses Konto
                    </span>
                  </div>
                  <h3 className="text-2xl font-black">
                    {isRegistering ? "Registrieren" : "Anmelden"}
                  </h3>
                  <p className="text-xs text-emerald-100 opacity-90">
                    {isRegistering
                      ? "Erstelle ein Konto, um deinen Bewässerungsplan zu sichern."
                      : "Melde dich an, um deine Pläne zu sichern und abzurufen."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsPlannerAuthModalOpen(false);
                    setAuthError("");
                  }}
                  className="text-white hover:text-emerald-250 hover:text-emerald-200 p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body */}
              <form
                onSubmit={handlePlannerAuthSubmit}
                className="p-6 space-y-4"
              >
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {isRegistering ? (
                  /* Registration fields */
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="z.B. gartenfreund"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        E-Mail-Adresse *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="deine@adresse.de"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        Vollständiger Name
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="z.B. Max Mustermann"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        Passwort *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-505 uppercase">
                        Passwort wiederholen *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPasswordRepeat}
                        onChange={(e) => setRegPasswordRepeat(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                ) : (
                  /* Login fields */
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        Benutzername
                      </label>
                      <input
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="Dein Benutzername"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">
                        Passwort
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-800"
                        placeholder="Dein Passwort"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-3">
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md hover:shadow-lg cursor-pointer text-sm"
                  >
                    {isRegistering
                      ? "Registrieren & Weiter"
                      : "Anmelden & Weiter"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setAuthError("");
                    }}
                    className="w-full text-center text-xs text-gray-500 hover:text-emerald-700 font-semibold cursor-pointer"
                  >
                    {isRegistering
                      ? "Bereits registriert? Jetzt anmelden"
                      : "Noch kein Konto? Jetzt registrieren"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
