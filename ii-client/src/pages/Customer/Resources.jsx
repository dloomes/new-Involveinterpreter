import { useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { jsPDF } from "jspdf";

// ─── Guide content (shared by screen + print) ─────────────────────────
// Step bodies use HTML for inline emphasis; rendered safely via dangerouslySetInnerHTML.
const guides = [
  {
    id: "create",
    icon: <AddCircleOutlineIcon sx={{ color: "#0c6ea6" }} />,
    title: "How to make a booking",
    summary: "Request a BSL interpreter for a meeting or event.",
    steps: [
      {
        title: "Open the New Booking form",
        body: 'From your dashboard or the <strong>My Bookings</strong> page, click the <strong>New booking</strong> button in the top right.',
      },
      {
        title: "Choose the date and time",
        body: 'Set the <strong>Booking date</strong>, <strong>Start time</strong>, and <strong>Duration</strong>. The duration determines how long the interpreter is booked for.',
      },
      {
        title: "Select the booking type",
        body: 'Choose from the <strong>Booking type</strong> dropdown (e.g. one-to-one, team, group, event). For team, group, or event bookings, you\'ll be asked for the number of attendees and an optional prep contact.',
      },
      {
        title: "Enter attendee details",
        body: 'Provide the <strong>Deaf attendee</strong> name and (where relevant) the <strong>Professional name and email</strong>. If the professional is provided, they\'ll be copied into all booking emails so they stay informed.',
      },
      {
        title: "Add your contact details",
        body: 'Enter a <strong>Contact email</strong> and <strong>Contact number</strong> we can use on the day. Optionally add a <strong>Customer PO</strong> for your records.',
      },
      {
        title: "Provide a video link (optional)",
        body: 'If your meeting already has a video link (Teams, Zoom, etc.), paste it into <strong>Video URL</strong>. Leave it blank and we\'ll generate one automatically once an interpreter is assigned.',
      },
      {
        title: "Add any extra information",
        body: 'Use the <strong>Additional info</strong> field for anything the interpreter should know in advance — meeting context, vocabulary, accessibility notes, etc.',
      },
      {
        title: "Submit the booking",
        body: 'Click <strong>Submit</strong>. You\'ll receive a confirmation email and the booking will appear in <strong>My Bookings</strong> and on your <strong>Calendar</strong> with a status of <strong>Pending</strong> until an interpreter is assigned.',
      },
    ],
    tip: 'Bookings made within 48 hours of the meeting may be billable even if you cancel them — see <em>How to cancel a booking</em> for details.',
  },
  {
    id: "edit",
    icon: <EditOutlinedIcon sx={{ color: "#0c6ea6" }} />,
    title: "How to edit a booking",
    summary: "Change the time, duration, or other details of an existing booking.",
    steps: [
      {
        title: "Find the booking",
        body: 'Open <strong>My Bookings</strong>, <strong>Pending Bookings</strong>, <strong>Future Bookings</strong>, or your <strong>Calendar</strong> — any page that shows your bookings will work.',
      },
      {
        title: "Open the details",
        body: 'Click (or tap) the row for the booking you want to edit. A details dialog will appear.',
      },
      {
        title: "Click Edit",
        body: 'Click the blue <strong>Edit</strong> button at the bottom of the details dialog. The full booking form opens with all current values pre-filled.',
      },
      {
        title: "Make your changes and save",
        body: 'Update any fields you need to change, then click <strong>Save</strong>. Your changes are applied immediately.',
      },
      {
        title: "Confirmation",
        body: 'A confirmation email is sent to you (and the professional, if their email is on the booking) summarising the new details. The Outlook calendar entry is updated automatically.',
      },
    ],
    tip: "Cancelled bookings can't be edited. If you need to revive a cancelled booking, please make a new one or contact us.",
  },
  {
    id: "cancel",
    icon: <CancelOutlinedIcon sx={{ color: "#dc2626" }} />,
    title: "How to cancel a booking",
    summary: "Cancel a booking you no longer need.",
    steps: [
      {
        title: "Find the booking",
        body: 'Open <strong>My Bookings</strong>, <strong>Pending Bookings</strong>, <strong>Future Bookings</strong>, or your <strong>Calendar</strong>.',
      },
      {
        title: "Open the details",
        body: 'Click (or tap) the row for the booking you want to cancel.',
      },
      {
        title: "Click Cancel",
        body: 'Click the red <strong>Cancel</strong> button at the bottom of the details dialog.',
      },
      {
        title: "Provide a reason",
        body: 'Choose a reason from the dropdown (or pick <strong>Other</strong> and type your own). A reason is required.',
      },
      {
        title: "Confirm",
        body: 'Click <strong>Confirm cancellation</strong>. The booking moves to <strong>Cancelled Bookings</strong> and a confirmation email is sent.',
      },
    ],
    tip: '<strong>Late cancellations:</strong> if a booking is cancelled within 48 hours of the start time <em>and</em> an interpreter has already been assigned, the booking will still be billable. Cancel as early as possible to avoid charges.',
  },
];

// ─── PDF generation ──────────────────────────────────────────────────
// Parse a small HTML subset (<strong>, <b>, <em>, <i>) into styled text runs.
const decodeEntities = (s) =>
  s.replace(/&nbsp;/g, " ")
   .replace(/&amp;/g, "&")
   .replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'");

const parseRuns = (html) => {
  const runs = [];
  let bold = false;
  let italic = false;
  const re = /<\/?(strong|b|em|i)\s*>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[2]) {
      runs.push({ text: decodeEntities(m[2]), bold, italic });
    } else {
      const tag = m[0].toLowerCase();
      const isClosing = tag.startsWith("</");
      const name = tag.replace(/<\/?|>/g, "").trim();
      if (name === "strong" || name === "b") bold = !isClosing;
      else if (name === "em" || name === "i") italic = !isClosing;
    }
  }
  return runs;
};

// Render a sequence of runs at (x,y) wrapped to maxWidth. Returns final y.
const drawRuns = (doc, runs, x, y, maxWidth, lineHeight, color = [71, 85, 105]) => {
  doc.setTextColor(color[0], color[1], color[2]);
  let cursorX = x;
  let cursorY = y;
  const startX = x;
  const fontSize = doc.getFontSize();
  // Tokenize each run into words while preserving the run's style
  const tokens = [];
  runs.forEach((r) => {
    const parts = r.text.split(/(\s+)/);
    parts.forEach((p) => {
      if (p === "") return;
      tokens.push({ text: p, bold: r.bold, italic: r.italic, isSpace: /^\s+$/.test(p) });
    });
  });

  tokens.forEach((tok) => {
    const style = tok.bold && tok.italic ? "bolditalic" : tok.bold ? "bold" : tok.italic ? "italic" : "normal";
    doc.setFont("helvetica", style);
    const w = (doc.getStringUnitWidth(tok.text) * fontSize) / doc.internal.scaleFactor;
    if (!tok.isSpace && cursorX + w > startX + maxWidth) {
      cursorX = startX;
      cursorY += lineHeight;
    }
    if (tok.isSpace && cursorX === startX) return; // skip leading whitespace on a wrap
    doc.text(tok.text, cursorX, cursorY);
    cursorX += w;
  });

  return cursorY;
};

const downloadGuide = (guide) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 24;
  const marginBottom = 20;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("INVOLVE INTERPRETER", marginX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(guide.title, marginX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const summaryLines = doc.splitTextToSize(guide.summary, contentW);
  doc.text(summaryLines, marginX, y);
  y += summaryLines.length * 5 + 2;

  // Divider
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, marginX + contentW, y);
  y += 8;

  // Steps
  const stepNumberSize = 6;
  const stepGap = 3;
  const titleSize = 11;
  const bodySize = 10;
  const lineH = 5;

  guide.steps.forEach((s, i) => {
    const runs = parseRuns(s.body);

    // Estimate height
    doc.setFontSize(bodySize);
    doc.setFont("helvetica", "normal");
    const bodyText = runs.map((r) => r.text).join("");
    const wrapped = doc.splitTextToSize(bodyText, contentW - stepNumberSize - stepGap);
    const stepHeight = 6 + wrapped.length * lineH + 4;
    ensureSpace(stepHeight);

    // Step number circle
    doc.setFillColor(239, 246, 255);
    doc.circle(marginX + stepNumberSize / 2, y + stepNumberSize / 2 - 0.5, stepNumberSize / 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text(String(i + 1), marginX + stepNumberSize / 2, y + stepNumberSize / 2 + 0.8, { align: "center" });

    // Step title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    doc.setTextColor(15, 23, 42);
    doc.text(s.title, marginX + stepNumberSize + stepGap, y + 4);

    // Step body
    doc.setFontSize(bodySize);
    const bodyY = y + 4 + lineH + 1;
    drawRuns(
      doc,
      runs,
      marginX + stepNumberSize + stepGap,
      bodyY,
      contentW - stepNumberSize - stepGap,
      lineH,
    );

    y = bodyY + wrapped.length * lineH + 3;
  });

  // Tip
  if (guide.tip) {
    const tipRuns = [{ text: "Tip: ", bold: true, italic: false }, ...parseRuns(guide.tip)];
    const padding = 4;
    doc.setFontSize(bodySize);
    doc.setFont("helvetica", "normal");
    const fullText = tipRuns.map((r) => r.text).join("");
    const tipLines = doc.splitTextToSize(fullText, contentW - padding * 2);
    const boxH = tipLines.length * lineH + padding * 2;
    ensureSpace(boxH + 4);

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, y, contentW, boxH, 2, 2, "FD");
    drawRuns(
      doc,
      tipRuns,
      marginX + padding,
      y + padding + lineH - 1,
      contentW - padding * 2,
      lineH,
      [120, 53, 15],
    );
    y += boxH + 6;
  }

  // Footer (always on last page bottom)
  const footerY = pageH - marginBottom + 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerY - 4, marginX + contentW, footerY - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Need more help? Email bookings@involveinterpreter.com",
    marginX,
    footerY,
  );

  const fileName = `Involve Interpreter - ${guide.title}.pdf`;
  doc.save(fileName);
};

// ─── Screen render helpers ────────────────────────────────────────────
const Step = ({ n, title, body }) => (
  <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
    <Box
      sx={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: "50%",
        bgcolor: "#eff6ff",
        color: "#1e40af",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "0.85rem",
      }}
    >
      {n}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="body2" fontWeight={600} sx={{ color: "#0f172a", mb: 0.5 }}>
        {title}
      </Typography>
      <Box
        sx={{ color: "#475569", fontSize: "0.875rem", lineHeight: 1.65 }}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </Box>
  </Box>
);

const Tip = ({ html }) => (
  <Box
    sx={{
      mt: 2.5,
      p: 2,
      borderRadius: 2,
      bgcolor: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#78350f",
      fontSize: "0.85rem",
      lineHeight: 1.6,
    }}
  >
    <strong>Tip:</strong>{" "}
    <span dangerouslySetInnerHTML={{ __html: html }} />
  </Box>
);

export default function Resources() {
  const [expanded, setExpanded] = useState("create");
  const handleChange = (id) => (_e, isExp) => setExpanded(isExp ? id : false);

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <HelpOutlineIcon sx={{ color: "#0c6ea6", fontSize: 28 }} />
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a" }}>
            Resources
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Quick guides for common tasks. Click a topic to expand it, or use the
          download button to save a printable copy.
        </Typography>
      </Box>

      <Box>
        {guides.map((g) => (
          <Accordion
            key={g.id}
            expanded={expanded === g.id}
            onChange={handleChange(g.id)}
            disableGutters
            elevation={0}
            sx={{
              borderRadius: "12px !important",
              border: "1px solid #e2e8f0",
              bgcolor: "#fff",
              mb: 1.5,
              overflow: "hidden",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: "#64748b" }} />}
              sx={{
                py: 1,
                "& .MuiAccordionSummary-content": {
                  alignItems: "center",
                  gap: 1.5,
                  my: "12px !important",
                },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {g.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" fontWeight={600} sx={{ color: "#0f172a" }}>
                  {g.title}
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.8rem" }}>
                  {g.summary}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  downloadGuide(g);
                }}
                sx={{
                  ml: 1,
                  flexShrink: 0,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  borderColor: "#e2e8f0",
                  color: "#475569",
                  display: { xs: "none", sm: "inline-flex" },
                  "&:hover": { borderColor: "#0c6ea6", color: "#0c6ea6", bgcolor: "#eff6ff" },
                }}
              >
                Download
              </Button>
            </AccordionSummary>
            <Divider />
            <AccordionDetails sx={{ p: 3, bgcolor: "#f8fafc" }}>
              {g.steps.map((s, i) => (
                <Step key={i} n={i + 1} title={s.title} body={s.body} />
              ))}
              {g.tip && <Tip html={g.tip} />}
              {/* Mobile-only download button (hidden on sm+) */}
              <Box sx={{ display: { xs: "flex", sm: "none" }, mt: 3, justifyContent: "flex-end" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
                  onClick={() => downloadGuide(g)}
                  sx={{
                    borderRadius: 2, textTransform: "none", fontWeight: 600,
                    borderColor: "#e2e8f0", color: "#475569",
                    "&:hover": { borderColor: "#0c6ea6", color: "#0c6ea6", bgcolor: "#eff6ff" },
                  }}
                >
                  Download this guide
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Box
        sx={{
          mt: 4,
          p: 3,
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          bgcolor: "#fff",
          textAlign: "center",
        }}
      >
        <Typography variant="body2" sx={{ color: "#475569", mb: 0.5 }}>
          Need more help?
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Email us at{" "}
          <a
            href="mailto:bookings@involveinterpreter.com"
            style={{ color: "#0c6ea6", fontWeight: 600, textDecoration: "none" }}
          >
            bookings@involveinterpreter.com
          </a>{" "}
          and we'll be happy to help.
        </Typography>
      </Box>
    </Box>
  );
}
